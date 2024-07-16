const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();
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
            
            const userInfo ={
                name: req.body.name,
                email: req.body.email,
                phone: req.body.phone,
                type: req.body.type,
                pin : securePin
            }
            const result = await usersCollection.insertOne(userInfo);

            res.send(result);
        })


        app.get('/login', async (req, res) =>{
            const emailOrNumber = req.query.emailOrNumber;
            const pin = req.query.pin;

            console.log('emailOrNumber and pin', emailOrNumber, pin);

            const query = {
                $or: [
                  { email: emailOrNumber },
                  { phone: emailOrNumber }
                ]
              };

              const user = await usersCollection.findOne(query);

            //   if (user) {
            //     console.log('User exists:', user);
            //     return res.send({user : true});
            //   } else {
            //     console.log('User does not exist');
            //     return res.send({user : false});
            //   }


              if (user) {
                const isPinValid = await bcrypt.compare(pin, user.pin);
                if (isPinValid) {
                  console.log('User exists:', user);
                  return res.send({user : true, pin : true, type: user.type});
                } else {
                  console.log('Invalid pin');
                  return res.send({user : true, pin : false});
                }
              } else {
                console.log('User does not exist');
                return res.send({user : false});
              }


            
        })







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