//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose");



const app = express();

app.use(express.static("public"));
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

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});


const userSchema = new mongoose.Schema ({
  firstName: String,
  lastName: String,
  role: String,
  status: String,
  email: String,
  password: String,
  secret: String,
  leave: {
    type: Boolean,
    default: false
} 
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
  res.render("home");
});

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/employeeDashboard", function(req, res){
  if (req.isAuthenticated()){
    res.render("employeeDashboard");
  } else {
    res.redirect("/login");
  }
  
});

app.get("/adminDashboard", function(req, res){
  if (req.isAuthenticated()){
    User.find({"leave": true}, function(err, foundUsers){
      if (err){
        console.log(err);
      } else {
        if (foundUsers) {
          res.render("adminDashboard", {usersWithLeave: foundUsers});
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/dashboard", function(req, res){
  if (req.isAuthenticated()) {
    User.find({"secret": {$ne: null}}, function(err, foundUsers){
      if (err){
        console.log(err);
      } else {
        if (foundUsers) {
          res.render("dashboard", {usersWithSecrets: foundUsers});
        }
      }
    });
  } else {
    res.redirect("login")
  }
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.post("/register", function(req, res){

  User.register({username: req.body.username,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    role: req.body.role,
    status: req.body.status
  },
     req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        if (req.body.role === "admin") {
          res.redirect("/adminDashboard");
        } else {
          res.redirect("/employeeDashboard")
        }
        
      });
    }
  });
  
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



app.get("/submit", function(req, res){
  if (req.isAuthenticated()){
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function(req, res){
  const submittedSecret = req.body.secret;

//Once the user is authenticated and their session gets saved, their user details are saved to req.user.
  // console.log(req.user.id);

  User.findById(req.user.id, function(err, foundUser){
    console.log(foundUser)
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(function(){
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.post("/employeeDashboard", function(req, res){
  User.findById(req.user.id, function(err, foundUser){
    
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.leave = true;
        foundUser.save(function(){
          res.redirect("/employeeDashboard");
        });
      }
    }
  });
});


app.post("/adminDashboard", function(req, res){
  User.findById(req.body.id, function(err, foundUser){
    
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.leave = false;
        foundUser.save(function(){
          res.redirect("/adminDashboard");
        });
      }
    }
  });
});



app.listen(3000, function() {
    console.log("Server started on port 3000.");
  });