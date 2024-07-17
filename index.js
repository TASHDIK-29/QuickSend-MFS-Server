const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;


const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    // credentials: true,
    // optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json());

//YArlEwLZDCN9AFsv
//QuickSend





const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.iepmiic.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const usersCollection = client.db("QuickSend").collection("user");
        const usersTransactions = client.db("QuickSend").collection("usersTransactions");
        const cashInRequests = client.db("QuickSend").collection("cashInRequests");
        const cashOutRequests = client.db("QuickSend").collection("cashOutRequests");

        const SECRET_KEY = 'your-secret-key';



        // middleware
        const verifyToken = (req, res, next) => {
            // console.log('inside verify', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access!' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, SECRET_KEY, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access!' })
                }
                req.decoded = decoded;
                next();
            })
        }


        // save user data at DB
        app.post('/users', async (req, res) => {
            const user = req.body;

            // insert email if User does not exist
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exist!', insertedId: null })
            }

            const salt = await bcrypt.genSalt(10)
            const securePin = await bcrypt.hash(req.body.pin, salt)

            const userInfo = {
                name: req.body.name,
                email: req.body.email,
                phone: req.body.phone,
                type: req.body.type,
                pin: securePin,
                status: 'Pending',
                balance: 0
            }
            const result = await usersCollection.insertOne(userInfo);

            res.send(result);
        })


        app.post('/login', async (req, res) => {
            const { emailOrNumber, pin } = req.body;

            // console.log('emailOrNumber and pin', emailOrNumber, pin);

            const query = {
                $or: [
                    { email: emailOrNumber },
                    { phone: emailOrNumber }
                ]
            };

            const user = await usersCollection.findOne(query);


            if (user) {
                const isPinValid = await bcrypt.compare(pin, user.pin);
                if (isPinValid) {
                    console.log('User exists:', user);

                    const token = jwt.sign({ email: user.email }, SECRET_KEY, { expiresIn: '1h' });
                    res.json({ token });


                    // return res.send({ user: true, pin: true, type: user.type });
                } else {
                    console.log('Invalid pin');
                    return res.send({ user: true, pin: false });
                }
            } else {
                console.log('User does not exist');
                return res.send({ user: false });
            }



        })


        app.get('/user', verifyToken, async (req, res) => {
            const credential = req.query.credential;
            const query = {
                $or: [
                    { email: credential },
                    { phone: credential }
                ]
            };

            const user = await usersCollection.findOne(query);

            res.send(user);
        })



        app.get('/userRequest', verifyToken, async (req, res) => {
            const query = {
                type: 'User',
                status: 'Pending'
            }

            const pendingUsers = await usersCollection.find(query).toArray();

            res.send(pendingUsers);
        })

        app.patch('/userRequest', async (req, res) => {
            const email = req.query.email;

            const filter = { email: email };

            const updateDoc = {
                $set: {
                    status: `Activated`,
                    balance: 40
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);

            res.send(result);
        })

        app.get('/agentRequest', verifyToken, async (req, res) => {
            const query = {
                type: 'Agent',
                status: 'Pending'
            }

            const pendingAgents = await usersCollection.find(query).toArray();

            res.send(pendingAgents);
        })


        app.patch('/agentRequest', async (req, res) => {
            const email = req.query.email;

            const filter = { email: email };

            const updateDoc = {
                $set: {
                    status: `Activated`,
                    balance: 10000
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);

            res.send(result);
        })


        app.patch('/sendMoney', verifyToken, async (req, res) => {

            const sendMoneyInfo = req.body;
            console.log(sendMoneyInfo);

            const query = {
                phone: sendMoneyInfo.userNumber
            };

            const user = await usersCollection.findOne(query);
            const reduce = sendMoneyInfo.amount > 100 ? sendMoneyInfo.amount + 5 : sendMoneyInfo.amount

            const isPinValid = await bcrypt.compare(sendMoneyInfo.pin, user.pin);
            if (isPinValid) {
                const query2 = {
                    phone: sendMoneyInfo.receiverNumber,
                    type: 'User',
                    status: 'Activated'
                }
                const isActivatedUser = await usersCollection.findOne(query2);

                if (isActivatedUser) {

                    const filter1 = { phone: sendMoneyInfo.receiverNumber };
                    const filter2 = { phone: sendMoneyInfo.userNumber };

                    const updateDoc1 = {
                        $set: {
                            balance: isActivatedUser.balance + sendMoneyInfo.amount
                        }
                    };

                    const updateDoc2 = {
                        $set: {
                            balance: user.balance - reduce
                        }
                    };

                    const result1 = await usersCollection.updateOne(filter1, updateDoc1);
                    const result2 = await usersCollection.updateOne(filter2, updateDoc2);

                    return res.send({ pin: true, receiver: true, result1: result1, result2: result2 })

                }
                else {
                    res.send({ pin: true, receiver: false })
                }

            }
            else {
                return res.send({ pin: false })
            }

        })


        app.post('/sendMoneyTransaction', async (req, res) => {
            const transInfo = req.body;
            console.log(transInfo);

            const query = {
                phone: transInfo.receiverNumber
            };

            const receiver = await usersCollection.findOne(query);

            const transaction = {
                senderNumber: transInfo.userNumber,
                receiverNumber: transInfo.receiverNumber,
                receiverName: receiver.name,
                amount: transInfo.amount,
                type: 'Send Money',
                date: transInfo.date
            }

            const result = await usersTransactions.insertOne(transaction);

            res.send(result);
        })


        app.post('/cashInRequest', verifyToken, async (req, res) => {
            const cashInfo = req.body;
            console.log(cashInfo);


            const query = {
                phone: cashInfo.userNumber
            };

            const user = await usersCollection.findOne(query);

            const isPinValid = await bcrypt.compare(cashInfo.pin, user.pin);

            if (isPinValid) {
                const query2 = {
                    phone: cashInfo.agentNumber,
                    type: 'Agent',
                    status: 'Activated'
                }
                const isActivatedAgent = await usersCollection.findOne(query2);

                if (isActivatedAgent) {
                    const cashIn = {
                        senderNumber: cashInfo.userNumber,
                        agentNumber: cashInfo.agentNumber,
                        amount: cashInfo.amount,
                        date: new Date().toLocaleString()
                    }

                    const result = await cashInRequests.insertOne(cashIn);

                    return res.send(result);
                }
                else {
                    return res.send({ pin: true, agent: false })
                }
            }

            res.send({ pin: false });

        })

        app.get('/cashInRequest', verifyToken, async (req, res) => {
            const agentNumber = req.query.agentNumber;
            console.log('agentNumber=', agentNumber);
            const query = {
                agentNumber: agentNumber
            }

            const requests = await cashInRequests.find(query).toArray();

            res.send(requests);
        })


        app.patch('/cashInAccept', verifyToken, async (req, res) => {
            const id = req.query.id;
            console.log('id', id);

            const filter = { _id: new ObjectId(id) };
            const doc = await cashInRequests.findOne(filter);

            const query1 = { phone: doc.agentNumber };
            const agent = await usersCollection.findOne(query1);
            const query2 = { phone: doc.senderNumber };
            const sender = await usersCollection.findOne(query2);

            if (agent.balance >= doc.amount) {

                const updateDoc1 = {
                    $set: {
                        balance: agent.balance - doc.amount
                    }
                };

                const updateDoc2 = {
                    $set: {
                        balance: sender.balance + doc.amount
                    }
                };

                const result1 = await usersCollection.updateOne(query1, updateDoc1);
                const result2 = await usersCollection.updateOne(query2, updateDoc2);


                const request = await cashInRequests.deleteOne(filter);


                const transaction = {
                    senderNumber: doc.senderNumber,
                    receiverNumber: doc.agentNumber,
                    receiverName: agent.name,
                    amount: doc.amount,
                    type: 'Cash In',
                    date: new Date().toLocaleString()
                }

                const result = await usersTransactions.insertOne(transaction);


                return res.send({ result1, result2, request, balance: true });

            }
            else {
                return res.send({ balance: false })
            }


        })



        app.post('/cashOutRequest', verifyToken, async (req, res) => {
            const cashInfo = req.body;
            console.log(cashInfo);


            const query = {
                phone: cashInfo.userNumber
            };

            const user = await usersCollection.findOne(query);

            const isPinValid = await bcrypt.compare(cashInfo.pin, user.pin);

            if (isPinValid) {
                const query2 = {
                    phone: cashInfo.agentNumber,
                    type: 'Agent',
                    status: 'Activated'
                }
                const isActivatedAgent = await usersCollection.findOne(query2);

                if (isActivatedAgent) {
                    const cashOut = {
                        senderNumber: cashInfo.userNumber,
                        agentNumber: cashInfo.agentNumber,
                        amount: cashInfo.amount,
                        date: new Date().toLocaleString()
                    }

                    const result = await cashOutRequests.insertOne(cashOut);

                    return res.send(result);
                }
                else {
                    return res.send({ pin: true, agent: false })
                }
            }

            res.send({ pin: false });

        })


        app.get('/cashOutRequest', verifyToken, async (req, res) => {
            const agentNumber = req.query.agentNumber;
            // console.log('agentNumber=', agentNumber);
            const query = {
                agentNumber: agentNumber
            }

            const requests = await cashOutRequests.find(query).toArray();

            res.send(requests);
        })


        app.patch('/cashOutAccept', verifyToken, async (req, res) => {
            const id = req.query.id;
            console.log('id', id);

            const filter = { _id: new ObjectId(id) };
            const doc = await cashOutRequests.findOne(filter);

            const query1 = { phone: doc.agentNumber };
            const agent = await usersCollection.findOne(query1);
            const query2 = { phone: doc.senderNumber };
            const sender = await usersCollection.findOne(query2);

            if (agent.balance >= doc.amount) {

                const updateDoc1 = {
                    $set: {
                        balance: agent.balance + doc.amount + (doc.amount*.015)
                    }
                };

                const updateDoc2 = {
                    $set: {
                        balance: sender.balance - doc.amount - (doc.amount*.015)
                    }
                };

                const result1 = await usersCollection.updateOne(query1, updateDoc1);
                const result2 = await usersCollection.updateOne(query2, updateDoc2);


                const request = await cashOutRequests.deleteOne(filter);


                const transaction = {
                    senderNumber: doc.senderNumber,
                    receiverNumber: doc.agentNumber,
                    receiverName: agent.name,
                    amount: doc.amount,
                    type: 'Cash Out',
                    date: new Date().toLocaleString()
                }

                const result = await usersTransactions.insertOne(transaction);


                return res.send({ result1, result2, request, balance: true });

            }
            else {
                return res.send({ balance: false })
            }


        })








        // Protected route
        // app.get('/profile', (req, res) => {
        //     const token = req.headers['authorization'];
        //     if (!token) return res.status(401).send('Access denied');

        //     jwt.verify(token, SECRET_KEY, (err, decoded) => {
        //         if (err) {
        //             return res.status(401).send({ message: 'Unauthorized access!' })
        //         }
        //         req.decoded = decoded;
        //         console.log('decoded =',req.decoded.email);
        //         // next();
        //         return res.send(req.decoded.email)
        //     })
        // });








        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Job-task is on');
})

app.listen(port, () => {
    console.log(`job-task is on port ${port}`);
})