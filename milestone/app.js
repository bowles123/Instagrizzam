var express =  require("express");
var exphbs = require('express-handlebars');
var request = require('request');
var path = require("path");
var querystring = require('querystring')
var cfg = require('./config')
var session = require('express-session')
var bodyParser = require('body-parser')
var db = require('./db')
var Users = require('./models/users')
var name;
var router = express.Router();
var SEARCH_QUERY = ''
var app = express();
var PORT = 3000;
var save = false;

app.engine('handlebars', exphbs({defaultLayout: 'base'}));
app.set('view engine', 'handlebars');

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({ extended: false }))

app.use(session({
  cookieName: 'session',
  secret: 'bcb',
  resave: false,
  saveUninitialized: true
}))

app.get("/", function(req, res){
  req.session.access_token = null
  res.render('home', {layout: 'homepage'})
});

app.get('/authorize', function(req, res){
  var qs = {
    client_id: cfg.client_id,
    redirect_uri: cfg.redirect_uri,
    response_type: 'code'
  }

  var query = querystring.stringify(qs)

  var url = 'https://api.instagram.com/oauth/authorize/?' + query

  res.redirect(url)
})

app.get('/auth/finalize', function(req, res, next){
  if (req.query.error == 'access_denied') {
      return res.redirect('/')
  }

  var post_data = {
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    redirect_uri: cfg.redirect_uri,
    grant_type: 'authorization_code',
    code: req.query.code
  }

  var options = {
    url: 'https://api.instagram.com/oauth/access_token',
    form: post_data
  }

  request.post(options, function(error, response, body){
    try {
      var data = JSON.parse(body)
      var user = data.user
    }
    catch(err) {
      return next(err)
    }

    name = data.user.full_name
    req.session.access_token = data.access_token
    req.session.userId = data.user.id
    user._id = user.id
    delete user.id

    Users.find(user._id, function(document) {
      if(!document) {
        Users.insert(user, function(result) {
          res.redirect('/dashboard')
        })
      } else {
        name = document.full_name
        res.redirect('/dashboard')
      }
    })
  })
})

app.get("/dashboard", function(req, res, next){
  var options = {
    url: 'https://api.instagram.com/v1/users/self/feed?access_token=' + req.session.access_token
  }
    request.get(options, function(error, response, body){
    try {
      var feed = JSON.parse(body)
      if (feed.meta.code > 200) {
        return next(feed.meta.error_message)
      }
    }
    catch(err) {
      return next(err)
    }

    res.render('dashboard', {
      feed: feed.data,
      Username: name
    })
  })
});

app.get('/profile', function(req, res) {
  if (req.session.userId) {
    //Find user
    Users.find(req.session.userId, function(document) {
      if (!document) return res.redirect('/')
      res.render('profile', {
        userInfo: document,
        Username: name
      })
    })
  } else {
    res.redirect('/')
  }
})

app.post("/profile", function(req, res) {
  var user = req.body
  var data;

  Users.find(req.session.userId, function(document) {
    if(!document) return res.rediret('/')
    data = document

    data.bio = user.biography
    data.website = user.website
    var substring = "http://"

    if(data.website.indexOf(substring) > -1) {
      data.website = data.website.replace(substring, "")
    }

    if(user.username == '') {
      user.username = document.username
    }
    else {
      data.username = user.username
    }
    if(user.fullName == '') {
      user.fullName = document.full_name
    }
    else {
      data.full_name = user.fullName
    }
    name = user.fullName

    Users.update(data, function() {
      res.render('profile', {
        userInfo: data,
        Username: name
      })
    })
  })
})

app.get("/savedSearches", function(req, res){
  if (req.session.userId) {
    //Find user
    Users.find(req.session.userId, function(document) {
      if (!document) return res.redirect('/')
      //Render the update view
      res.render('savedSearches', {
        user: document,
        Username: name
      })
    })
  } else {
    res.redirect('/savedSearches')
  }
});

app.post('/savedSearches/add', function(req, res) {
  var savedSearch = req.body.query
  var userId = req.session.userId

    //Add the tag to the user
    Users.addSavedSearch(userId, savedSearch, function() {
      res.redirect('/savedSearches')
    })
})

app.post('/savedSearches/remove', function(req, res) {
  var savedSearch = req.body.savedSearch
  var userId = req.session.userId

  //Add the tag to the user
  Users.removeSavedSearch(userId, savedSearch, function() {
    res.redirect('/savedSearches')
  })
})

db.connect('mongodb://bowles123:password@ds051943.mongolab.com:51943/testing', function(err) {
  if (err) {
    console.log('Unable to connect to Mongo.')
    process.exit(1)
  } else {
    app.listen(3000, function() {
      console.log('Listening on port 3000...')
    })
  }
})

// SEARCH PAGE \\

app.get('/search', function(req, res, next) {
  if (req.session.access_token == null) {
    res.redirect('localhost:3000/')
  } else {

    if (SEARCH_QUERY == '') {
      res.render('search', {
          title: 'Search',
          feed: {},
          Username: name
        })
      }
     else {


      var options = {
        url: 'https://api.instagram.com/v1/tags/' + SEARCH_QUERY + '/media/recent?access_token=' + req.session.access_token + '&count=9'

      }
      console.log(options.url)

      request.get(options, function(error, response, body) {

        if (error) {
          console.log("error if 1")
          return next(error)
        }
        try {
          var feed = JSON.parse(body)
        } catch (err) {
          console.log("error if 2")
            // return error if what we get back is HTML code
          return next(err) // displays the error on the page
            // return res.reditect('/') // just redirects to homepage
        }

        if (feed.meta.code > 200) {
          console.log("error code above 200")
          return next(feed.meta.error_message)
        }

        res.render('search', {
          title: 'Search',
          feed: feed.data,
          Username: name
        })
      })
    }
  }
})

app.post('/search', function(req, res) {
  var query = req.body.query

  var options = {
    url: 'https://api.instagram.com/v1/tags/' + query +'/media/recent?access_token=' + req.session.access_token
  }
    request.get(options, function(error, response, body){
    try {
      var feed = JSON.parse(body)
      if (feed.meta.code > 200) {
        return next(feed.meta.error_message)
      }
    }
    catch(err) {
      return next(err)
    }

    res.render('search', {
      feed: feed.data,
      Username: name
    })
  })
})

app.use(function(err, req, res, next) {
  res.status(err.status || 500)
  res.render('error', {
    message: err,
    error: {}
  })
})
// SEARCH PAGE END \\
