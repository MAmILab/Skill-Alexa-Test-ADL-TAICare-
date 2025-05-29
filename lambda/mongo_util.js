
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://taicareuser:TAICarePass2024*@taicare.8av42jp.mongodb.net/?retryWrites=true&w=majority&appName=TAICare";

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
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB! BIEEEEEN!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

async function insertQuizResult(doc){
    await client.connect();
    const myDB = client.db("TAICare");
    const myColl = myDB.collection("Quiz_Results");
    const result = await myColl.insertOne(doc);
    console.log( `A quiz result document was inserted with the _id: ${result.insertedId}`);
    await client.close();
}

async function getAnomalies(adl){
    console.log("estoy buscando anomalias");
    await client.connect();
    const myDB = client.db("TAICare");
    const myColl = myDB.collection("Detected_Anomalies");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date();
    endOfYesterday.setHours(23, 59, 59, 999);
    
    const cursor = await myColl.find({
      adl: adl,
      date: {
        $gte: yesterday,
        $lt: endOfYesterday
      },
    }).sort({ date: -1 });
    console.log("pasando anomalias a un array");
    var findResult = await cursor.toArray();
    console.log("hay "+findResult.length+" anomalias encontradas")
    var result= [];
    for (const doc of findResult) {
        console.log("hay una anomalia");
        result.push(doc);
    }
    await client.close();
    return result.length === 0 ? null : result ;
}

//run().catch(console.dir);
module.exports = {
    'run': run,
    'insertQuizResult' : insertQuizResult,
    'getAnomalies' : getAnomalies
};