const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
require('mongoose-strip-html-tags')(mongoose);

const slug = require('slugs');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name!',
    stripHtmlTags: true
  },
  slug: {
    type: String,
    stripHtmlTags: true
  },
  description: {
    type: String,
    trim: true,
    stripHtmlTags: true

  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: 'You must supply the coordinates!'
    },
    address: {
      type: String,
      required: 'You must supply an address!',
      stripHtmlTags: true
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author',
    stripHtmlTags: true
  }
}, {
  toJSON: {
    virtuals: true
  },
  toObject: {
    virtuals: true
  }
});

// Define indexes

storeSchema.index({
  name: 'text',
  description: 'text'
});

storeSchema.index({
  location: '2dsphere'
});

storeSchema.pre('save', async function (next) {
  if (!this.isModified('name')) {
    return next();
  }
  this.slug = slug(this.name);
  // find other stores with same slug
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)`, 'i');
  const storesWithSlug = await this.constructor.find({
    slug: slugRegEx
  });
  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }
  next();
});

storeSchema.statics.getTagsList = function () {
  return this.aggregate([
    {
      $unwind: '$tags'
    },
    {
      $group: {
        _id: '$tags',
        count: {
          $sum: 1
        }
      }
    },
    {
      $sort: {
        count: -1
      }
    }
  ]);
};

storeSchema.statics.getTopStores = function () {
  return this.aggregate([
    // Lookup stores and populate their reviews
    {
      $lookup: {
        from: 'Review',
        localField: '_id',
        foreignField: 'store',
        as: 'reviews'
      }
    },
    // filter for only items with two or more reviews
    {
      $match: {
        'reviews.1': {
          $exists: true
        }
      }
},
    // Add the average reviews field
    {
      $addFields: {
        averageRating: {
          $avg: '$reviews.rating'
        }
      }
    },
    // sort it by out new field
    {
      $sort: {
        averageRating: -1
      }
    },
    // limit to 10
    {
      $limit: 10
    }
  ])
}

// find review where the stores._id === reviews.store
storeSchema.virtual('reviews', {
  ref: 'Review', // what model to link
  localField: '_id', // which field on the store
  foreignField: 'store' // which field on review 
});

function autopopulate(next) {
  this.populate('reviews');
  next()
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);




module.exports = mongoose.model('Store', storeSchema);
