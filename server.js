require("./config/config");
const _ = require('lodash');
const bodyParser = require('body-parser');
const express = require('express');

const {ObjectID} = require('mongodb');
const {mongoose} = require('./db/mongoose');
const {Todo} = require('./models/todo');
const {User} = require('./models/user');
const {authenticate} = require("./middleware/authenticate");

let app = express();

const port = process.env.PORT;
console.log(port);
app.use(bodyParser.json());

//adding todo
app.post('/todos', authenticate, (req, res)=>{
  let todo1 = new Todo({
    text: req.body.text,
    _creator: req.user._id        //associating todo with its user
  });

  todo1.save().then((result)=>{
    res.send("successfully added data to table\n"+result);
  },(error)=>{
    res.status(400).send(error);
  });
});

//list of all todos
app.get('/todos', authenticate, (req, res)=>{
  Todo.find({
    _creator: req.user._id    //to ensure the privacy of user
  }).then((doc)=>{
    res.send(doc);
  },(err)=>{
    res.status(400).send(err);
  })
});

//finding by id ....route
app.get('/todos/:id', authenticate,(req, res)=>{
  var id = req.params.id;
  if(!ObjectID.isValid(id)){
    return res.status(404).send("Not a valid id");
  };
  Todo.findOne({
    _id: id,
    _creator: req.user._id        //finding only the associated todo
  }).then((todo)=>{
    if(todo == null)
      res.status(404).send("No data with this id");
    else
      res.send("-------\n"+todo);
  },(error)=>{
    res.send(error);
  });
});

//deleting by id ....route
app.delete('/todos/:id', authenticate, (req, res)=>{
  let id = req.params.id;
  if(!ObjectID.isValid(id)){
    res.status(404).send("Not a valid id: "+id);
  }
  else{
    Todo.findOneAndRemove({
      _id: id,
      _creator: req.user._id      //again checking for only user's todo
    }).then((todo)=>{
      if(todo === null){
        res.status(404).send("Cant find the todo");
      }
      else{
        res.send("todo deleted :\n"+todo);
      }
    }).catch((e)=>{
      res.status(400).send("error : "+ e);
    })
  }
});

//reset route
app.get('/reset',(req, res)=>{
    Todo.remove({}).then((doc)=>{
      console.log(doc);
      console.log("\n---------------------------\n");
  });
  User.remove({}).then((doc)=>{
    console.log(doc);
  });
  res.send("Data has been reset");
});

//updating //authentication added
app.patch('/todos/:id', authenticate, (req, res)=>{
  let id = req.params.id;
  let body = _.pick(req.body,["text","completed"]);
  if(!ObjectID.isValid(id)){
      return res.status(404).send("Not a valid id: "+id);
  }
  if(_.isBoolean(body.completed) && body.completed)
  {
    body.completedat = new Date().getTime();
  }
  else{
    body.completed = false;
    body.completedat = null;
  }
  // Todo.findByIdAndUpdate(id,{$set:{"text":"hey"}},{new : true}).then((res)=>{
  //   res.send(res);
  // })
  Todo.findOneAndUpdate({
        _id: id,
        _creator: req.user._id
      }, {$set : body },{new : true}).then((todo)=>{
      if(!todo)
      {
        return res.status(404).send("Cant update.");
      }
      res.send(todo);
    }).catch((e)=>{
    res.status(400).send("error:  "+e);
  })

});

//adding User
app.post('/users',(req, res)=>{
  let body = _.pick(req.body,['email','password']);
  let user = new User(body);
  user.save().then(()=>{
    return user.generateAuthToken();
    // return res.send(user);
  }).then((token)=>{
    return res.header('x-auth',token).send(user);
  }).catch((e)=>{
    return res.status(400).send('Server : User with this email is already in db.\n\n' + e);
  })
});

//auth test
app.get('/users/me', authenticate, (req, res)=>{
  res.send(req.user);
})

//Login User
app.post('/users/login',(req, res)=>{
  var body = _.pick(req.body,['email','password']);
  let email = body.email;
  let password = body.password;

  User.findByCredentials(email, password).then((user)=>{
    console.log("--");
    user.generateAuthToken().then((token)=>{
      res.header('x-auth',token).send(user);
    });
  }).catch((e)=>{
    res.status(400).send("Incorrect Password. "+e);
  });
});

//Log Out // removing token from db
app.delete("/users/me/token", authenticate, (req, res)=>{
  req.user.removeToken(req.token).then(()=>{
    res.status(200).send("Token removed");
  },(reject)=>{
    res.status(400).send(reject);
  })
});

app.listen(port,()=>{
  console.log(`Connected to the Server ${port}`);
});
