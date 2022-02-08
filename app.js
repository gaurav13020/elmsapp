//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose");
const { authPage } = require("./middlewares")



const app = express();

app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: 'Our little secret.',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const atlas_url = process.env.URL;

mongoose.connect(atlas_url, {useNewUrlParser: true});

const leaveSchema = new mongoose.Schema({
  startDate: Date,
  endDate: Date,
  type: String,
  reason: String,
  status: String,
  adminRemark: String,
})


const userSchema = new mongoose.Schema ({
  firstName: String,
  lastName: String,
  role: String,
  status: String,
  email: String,
  password: String,
  leavesRemaining: String,
  leave: [leaveSchema]
});

userSchema.plugin(passportLocalMongoose);


const User = new mongoose.model("User", userSchema);



passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});





app.get("/", function(req, res){
  res.redirect("/login");
});

app.get("/login", function(req, res){
  res.render("login");
});



app.post("/login", function(req, res){

  const user = new User({
     username: req.body.username,
     password: req.body.password
   });
 
   req.login(user, function(err){
     if (err) {
       console.log(err);
     } else {
       passport.authenticate("local")(req, res, function(){
         
         
         
           User.find({username: req.body.username}, function(err, foundUsers){
             // console.log(foundUsers)
             if (err){
               console.log(err);
             } else {
               if (foundUsers[0].role === "admin") {
                 res.redirect("/adminDashboard");
               } else {
                 res.redirect("/employeeDashboard");
               }
             }
           });
 
       });
     }
   });
 
 });



app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});




app.get("/register", authPage("admin"), function(req, res){
  res.render("register");
});

app.post("/register", function(req, res){

  User.register({username: req.body.username,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    role: req.body.role,
    status: req.body.status,
    leavesRemaining: "30",
  },
     req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      res.redirect("/adminDashboard");
    }
  });
  
});




app.get("/employeeDashboard", authPage("employee"), function(req, res){
  if (req.isAuthenticated()){
    res.render("employeeDashboard", {user : req.user});
  } else {
    res.redirect("/login");
  }
  
});



app.post("/employeeDashboard", function(req, res){

  const newLeave = {startDate: req.body.start,
                    endDate: req.body.end,
                    type: req.body.leaveType,
                    reason: req.body.reason,
                    status: "pending"};
  
     User.findOneAndUpdate({_id: req.user.id}, {$push: {leave: newLeave}},{upsert: false},function(err){
       if (err) {
         console.log(err);
       } else {
         res.redirect("/employeeDashboard");
       }
     })

  
});

app.post("/employeeDashboard/delete-message", function(req, res){
  User.findById(req.user.id, function(err, foundUser){
    
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {

        foundUser.leave.forEach(function(leaves){
        if (leaves.id === req.body.id) {
          leaves.adminRemark = "";
          foundUser.save();
          res.redirect("/employeeDashboard");
          
        }
      });

        // foundUser.leave = true;
        // foundUser.save(function(){
        //   res.redirect("/employeeDashboard");
        // });
      }
    }
  });
});





app.get("/adminDashboard", authPage("admin"),  function(req, res){
  if (req.isAuthenticated()){
    User.find({"role": "employee"}, function(err, foundUsers){
      if (err){
        console.log(err);
      } else {
        if (foundUsers) {
          res.render("adminDashboard", {employees: foundUsers});
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/adminDashboard/logs/:id", authPage("admin"),  function(req, res){
  if (req.isAuthenticated()){
    User.findById(req.params.id, function(err, foundUsers){
      if (err){
        console.log(err);
      } else {
        if (foundUsers) {
          console.log(foundUsers)
          res.render("logs", {logs: foundUsers});
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});


app.post("/pendingRequest/accept/:id", authPage("admin"), function(req, res){
  console.log(req.body.comment);
  User.findById(req.params.id, function(err, foundUser){
    if (err) {
      console.log(err);
    } else {
      foundUser.leave.forEach(function(leaves){
        if (leaves.id === req.body.docId) {
          const a = leaves.startDate;
          const b = leaves.endDate;
          const c = ((b-a)/86400000) + 1;
          foundUser.leavesRemaining = foundUser.leavesRemaining - c;
          leaves.status = "accepted";
          leaves.adminRemark = req.body.comment;
          foundUser.save();
          res.redirect("/pendingRequest");
          
        }
      });
      
    }
  });
});

app.post("/pendingRequest/reject/:id", function(req, res){
  User.findById(req.params.id, function(err, foundUser){
    if (err) {
      console.log(err);
    } else {
      foundUser.leave.forEach(function(leaves){
        if (leaves.id === req.body.docId) {
          leaves.status = "rejected";
          leaves.adminRemark = "Your leave has been rejected";
          foundUser.save();
          res.redirect("/pendingRequest");
          
        }
      });
      
    }
  });
});


app.get("/pendingRequest", authPage("admin"),  function(req, res){
  if (req.isAuthenticated()){
    User.find({"leave": {$ne: null},"leave.status": "pending"}, function(err, foundUsers){
      if (err){
        console.log(err);
      } else {
        if (foundUsers) {
          res.render("pendingRequest", {usersWithLeave: foundUsers});
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});



app.listen(3000, function() {
    console.log("Server started on port 3000.");
  });