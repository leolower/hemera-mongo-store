'use strict'

const Hp = require('hemera-plugin')
const Mongodb = require('mongodb')
const ObjectID = Mongodb.ObjectID
const MongoStore = require('./store')
const StorePattern = require('hemera-store/pattern')
const serialize = require('mongodb-extended-json').serialize
const deserialize = require('mongodb-extended-json').deserialize

function hemeraMongoStore(hemera, opts, done) {
  let topic = 'mongo-store'

  const preResponseHandler = result => {
    if (opts.serializeResult === true) {
      return serialize(result)
    }
    return result
  }

  Mongodb.MongoClient.connect(opts.mongo.url, opts.mongos.options, function(err, client) {
    if (err) {
      done(err)
      return
    }
    // Get the db from the mongodb client
    const db = client.db()
    // from mongodb driver
    const dbName = db.databaseName

    if (opts.useDbAsTopicSuffix) {
      topic = `mongo-store.${dbName}`
    }

    hemera.decorate('mongodb', {
      // @todo we might need to pass the connected client instead of the lib
      client: Mongodb,
      db
    })

    // Gracefully shutdown
    hemera.ext('onClose', (ctx, done) => {
      hemera.log.debug('Mongodb connection closed!')
      client.close(done)
    })

    const Joi = hemera.joi
    hemera.add(
      {
        topic,
        cmd: 'dropCollection',
        collection: Joi.string().required()
      },
      req =>
        db
          .collection(req.collection)
          .drop()
          .catch(() => false)
    )
    hemera.add(
      {
        topic,
        cmd: 'createCollection',
        collection: Joi.string().required()
      },
      req =>
        db
          .createCollection(req.collection, req.options)
          .then(() => true)
          .catch(() => false)
    )
    hemera.add(StorePattern.create(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID
      req.data = deserialize(req.data)

      return store.create(req)
    })
    hemera.add(StorePattern.update(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID
      req.query = deserialize(req.query)

      return store
        .update(req, deserialize(req.data))
        .then(resp => resp.value)
        .then(preResponseHandler)
    })
    hemera.add(StorePattern.updateById(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID

      return store
        .updateById(req, deserialize(req.data))
        .then(resp => resp.value)
        .then(preResponseHandler)
    })
    hemera.add(StorePattern.remove(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID
      req.query = deserialize(req.query)

      return store.remove(req)
    })
    hemera.add(StorePattern.removeById(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID

      return store
        .removeById(req)
        .then(resp => resp.value)
        .then(preResponseHandler)
    })
    hemera.add(StorePattern.replace(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID
      req.query = deserialize(req.query)

      return store.replace(req, deserialize(req.data))
    })
    hemera.add(StorePattern.replaceById(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID

      return store
        .replaceById(req, deserialize(req.data))
        .then(resp => resp.value)
        .then(preResponseHandler)
    })
    hemera.add(StorePattern.findById(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID

      return store.findById(req).then(preResponseHandler)
    })
    hemera.add(StorePattern.find(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID
      req.query = deserialize(req.query)

      return store.find(req, req.options).then(preResponseHandler)
    })
    hemera.add(StorePattern.count(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID
      req.query = deserialize(req.query)

      return store.count(req, req.options)
    })
    hemera.add(StorePattern.exists(topic), function(req) {
      const collection = db.collection(req.collection)
      const store = new MongoStore(collection, opts)
      store.ObjectID = ObjectID
      req.query = deserialize(req.query)

      return store.exists(req, req.options)
    })
    hemera.log.debug('DB connected!')
    done()
  })
}

module.exports = Hp(hemeraMongoStore, {
  hemera: '>=5.0.0',
  name: require('./package.json').name,
  dependencies: ['hemera-joi'],
  options: {
    mongos: {},
    serializeResult: false,
    mongo: {
      url: 'mongodb://localhost:27017/'
    },
    store: {
      replace: { upsert: true }
    }
  }
})
