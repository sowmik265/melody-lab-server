const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


//mongo start

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.evjqm5f.mongodb.net/?retryWrites=true&w=majority`;

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
        await client.connect();

        const usersCollection = client.db("melodyDB").collection("users");
        const instructorsCollection = client.db("melodyDB").collection("instructors");
        const reviewsCollection = client.db("melodyDB").collection("reviews");
        const classesCollection = client.db("melodyDB").collection("classes");
        const cartCollection = client.db("melodyDB").collection("carts");
        const paymentCollection = client.db("melodyDB").collection("payments");

        //JWT creation
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

            res.send({ token })
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        //READ operations

        //***instructors read***
        app.get('/instructors', async (req, res) => {
            const result = await instructorsCollection.find().toArray();
            res.send(result);
        })

        //***reviews read***
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        })

        //***users read***
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        //***classes read***
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        //***admin verifc read***
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        //***instructor verifc read***
        app.get('/users/instructor/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })

        //***specific users cart read***
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            console.log(email);
            if (!email) {
                res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: email }
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        //***specific instructors class read***
        app.get('/classes', verifyJWT, async (req, res) => {
            const email = req.query.email;
            console.log(email);
            if (!email) {
                res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: email }
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })

        //***specific users payment read***
        app.get('/payments', verifyJWT, async (req, res) => {
            const email = req.query.email;
            console.log(email);
            if (!email) {
                res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        //***payment read***
        app.get('/payments', async (req, res) => {
            const email = req.query.email;
            console.log(email);
            if (!email) {
                res.send([])
            }
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })


        //POST operations

        //***user profile post****
        app.post('/users', async (req, res) => {
            const user = req.body;
            //google user exixstance check
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        //***cart class post****
        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item)
            res.send(result);
        })

        //***class post****
        app.post('/classes', async (req, res) => {
            const newItem = req.body;
            const result = await classesCollection.insertOne(newItem)
            res.send(result);
        })

        //UPDATE operations
        //***user role update(make admin)****
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        //***user role update(make instructor)****
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })


        //***class status update(make approved)****
        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'approved'
                },
            };

            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })





        //DELETE operations
        //***cart delete****
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        //***user delete****
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        //***class delete****
        app.delete('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classesCollection.deleteOne(query);
            res.send(result);
        })






        // payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //payment post
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
            const deleteResult = await cartCollection.deleteMany(query)

            res.send({ insertResult, deleteResult });
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


//mongo end



//basic server
app.get('/', (req, res) => {
    res.send('melody is on air')
})

app.listen(port, () => {
    console.log(`melody is on air ${port}`);
})