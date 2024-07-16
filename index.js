const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
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



        app.get('/userRequest', verifyToken, async(req, res)=>{
            const query={
                type: 'User',
                status: 'Pending'
            }

            const pendingUsers = await usersCollection.find(query).toArray();

            res.send(pendingUsers);
        })

        app.get('/agentRequest', verifyToken, async(req, res)=>{
            const query={
                type: 'Agent',
                status: 'Pending'
            }

            const pendingAgents = await usersCollection.find(query).toArray();

            res.send(pendingAgents);
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