const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

app.use(cors());
app.use(express.json());

//DB_PASS=GTJh5l5TtdRWcYvm
//DB_USER = volunteer_management

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1gjqpi3.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const volunteerPostCollection = client
      .db("Volunteer_Management")
      .collection("volunteerNeedPosts");

    const volunteerReqCollection = client
      .db("Volunteer_Management")
      .collection("volunteerReq");

    //post volunteer post
    app.post("/addVolunteerPost", async (req, res) => {
      const volunteerPost = req.body;
      const result = await volunteerPostCollection.insertOne(volunteerPost);
      res.send(result);
    });

    //get voluteer post of specific user via email

    app.get("/volunteerPost", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { "organizer.email": email };
      }
      const result = await volunteerPostCollection.find(query).toArray();
      res.send(result);
    });

    //get voluteer post of specific user via id
    app.get("/volunteerPost/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerPostCollection.findOne(query);
      res.send(result);
    });

    app.delete("/volunteerPost/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerPostCollection.deleteOne(query);
      res.send(result);
    });

    //post volunteer aplication
    // POST Volunteer Request
    app.post("/volunteerAplications", async (req, res) => {
      const volunteerReq = req.body;
      const postId = volunteerReq.postId; // You must send this from frontend

      try {
        // 1️⃣ Insert volunteer request
        const insertResult = await volunteerReqCollection.insertOne(
          volunteerReq
        );

        // 2️⃣ Decrease volunteersNeeded by 1 using $inc
        const query = { _id: new ObjectId(postId) };
        const update = {
          $inc: { aplicant: +1 },
        };

        await volunteerPostCollection.updateOne(query, update);

        res.send({
          success: true,
          message: "Volunteer request saved & count updated",
          insertResult,
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    //get volunteer aplication by user email
    app.get("/volunteerAplications", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { "volunteer.volunteerEmail": email };
      }

      const result = await volunteerReqCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/volunteerAplications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      // 1️⃣ First fetch the application
      const application = await volunteerReqCollection.findOne(query);

      if (!application) {
        return res.status(404).send({ error: "Application not found" });
      }

      const postId = application.postId;

      // 2️⃣ Then delete the application
      const deleteResult = await volunteerReqCollection.deleteOne(query);

      // 3️⃣ Update volunteer post (increase needed, decrease applicant)
      const updateQuery = { _id: new ObjectId(postId) };

      let update = {};
      if (application.status == "accepted") {
        update = {
          $inc: { volunteersNeeded: 1, aplicant: -1 },
        };
      } else {
        update = {
          $inc: { aplicant: -1 },
        };
      }

      await volunteerPostCollection.updateOne(updateQuery, update);

      res.send(deleteResult);
    });

    app.get("/aplicants", async (req, res) => {
      const id = req.query.id;
      const query = { postId: id };
      const result = await volunteerReqCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/updateApplicantStatus/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      try {
        // 1️⃣ Update applicant status
        const result = await volunteerReqCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        // 2️⃣ Find the applicant to get postId
        const applicant = await volunteerReqCollection.findOne({
          _id: new ObjectId(id),
        });

        const postId = applicant.postId;

        // 3️⃣ Only decrease volunteersNeeded if accepted
        if (status === "accepted") {
          await volunteerPostCollection.updateOne(
            { _id: new ObjectId(postId) },
            {
              $inc: { volunteersNeeded: -1 },
            }
          );
        } 

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // UPDATE volunteer post
    app.put("/updateVolunteerPost/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            thumbnail: updatedData.thumbnail,
            title: updatedData.title,
            description: updatedData.description,
            category: updatedData.category,
            location: updatedData.location,
            volunteersNeeded: updatedData.volunteersNeeded,
            deadline: updatedData.deadline,
          },
        };

        const result = await volunteerPostCollection.updateOne(
          filter,
          updateDoc
        );

        res.send({
          success: true,
          message: "Volunteer Post Updated Successfully",
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Volunteer management server is running yeah");
});

app.listen(port, () => {
  console.log(`Volunteer management server is running on port ${port} yaay`);
});
