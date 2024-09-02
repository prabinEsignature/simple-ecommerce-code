const Product = require("../models/productModel");
const ErrorHander = require("../utils/errorhander");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ApiFeatures = require("../utils/apifeatures");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");

// Create Product -- Admin
exports.createProduct = catchAsyncErrors(async (req, res, next) => {
  let images = req.files;

  if (!images || images.length === 0) {
    return next(new ErrorHander("No images provided", 400));
  }

  const imagesLinks = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const result = await cloudinary.uploader.upload(images[i].path, {
        folder: "products",
        resource_type: "auto", // Automatically detect file type (image, video, etc.)
      });

      imagesLinks.push({
        publicId: result.public_id,
        url: result.secure_url,
      });
    } catch (error) {
      return next(new ErrorHander("Error uploading image to Cloudinary", 500));
    }
  }

  req.body.images = imagesLinks;
  req.body.user = req.user.id;

  const product = await Product.create(req.body);

  res.status(201).json({
    success: true,
    product,
  });
});

// Get All Product
exports.getAllProducts = catchAsyncErrors(async (req, res, next) => {
  const resultPerPage = 8;

  const apiFeature = new ApiFeatures(Product.find(), req.query)
    .search()
    .filter();

  const countQuery = new ApiFeatures(Product.find(), req.query)
    .search()
    .filter().query;

  const productsCount = await countQuery.countDocuments();
  apiFeature.pagination(resultPerPage);
  const products = await apiFeature.query;

  res.status(200).json({
    success: true,
    products,
    productsCount,
    resultPerPage,
    filteredProductsCount: productsCount,
  });
});

// Get All Product (Admin)
exports.getAdminProducts = catchAsyncErrors(async (req, res, next) => {
  const products = await Product.find();

  res.status(200).json({
    success: true,
    products,
  });
});

// Get Product Details
exports.getProductDetails = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHander("Product not found", 404));
  }

  res.status(200).json({
    success: true,
    product,
  });
});

// Update Product -- Admin

exports.updateProduct = catchAsyncErrors(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHander("Product not found", 404));
  }

  if (req.files && req.files.length > 0) {
    // Deleting existing images from Cloudinary
    for (let i = 0; i < product.images.length; i++) {
      await cloudinary.uploader.destroy(product.images[i].publicId);
    }

    const imagesLinks = [];
    for (const image of req.files) {
      try {
        const result = await cloudinary.uploader.upload(image.path, {
          folder: "products",
          resource_type: "auto",
        });

        imagesLinks.push({
          publicId: result.public_id,
          url: result.secure_url,
        });
      } catch (error) {
        return next(
          new ErrorHander("Error uploading image to Cloudinary", 500)
        );
      }
    }

    req.body.images = imagesLinks;
  }

  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
    product,
  });
});

// Delete Product
exports.deleteProduct = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHander("Product not found", 404));
  }

  try {
    if (product.images && product.images.length > 0) {
      // Deleting Images From Cloudinary
      for (let i = 0; i < product.images.length; i++) {
        await cloudinary.uploader.destroy(product.images[i].publicId);
      }
    }
  } catch (error) {
    return next(new ErrorHander("Error deleting images form Cloudinary", 500));
  }

  await product.deleteOne();

  res.status(200).json({
    success: true,
    message: "Product Delete Successfully",
  });
});

// Create New Review or Update the review
exports.createProductReview = catchAsyncErrors(async (req, res, next) => {
  const { rating, comment, productId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return next(new ErrorHander("Invalid Product ID", 400));
  }

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ErrorHander("Product not found", 404));
  }

  const existingReviewIndex = product.reviews.findIndex(
    (review) => review.user.toString() === req.user._id.toString()
  );

  if (existingReviewIndex !== -1) {
    product.reviews[existingReviewIndex].rating = rating;
    product.reviews[existingReviewIndex].comment = comment;
  } else {
    product.reviews.push({
      user: req.user._id,
      name: req.user.name,
      rating: Number(rating),
      comment,
    });
  }

  product.numOfReviews = product.reviews.length;
  product.ratings =
    product.reviews.reduce((acc, rev) => rev.rating + acc, 0) /
    product.reviews.length;

  await product.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
  });
});

// Get All Reviews of a product
exports.getProductReviews = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req.query.id);

  if (!product) {
    return next(new ErrorHander("Product not found", 404));
  }

  res.status(200).json({
    success: true,
    reviews: product.reviews,
  });
});

// Delete Review
exports.deleteReview = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req.query.productId);

  if (!product) {
    return next(new ErrorHander("Product not found", 404));
  }

  const reviews = product.reviews.filter(
    (review) => review._id.toString() !== req.query.id.toString() // pass review id in query
  );

  // Calculate the new average rating
  const avg = reviews.reduce((acc, rev) => acc + rev.rating, 0);
  const ratings = reviews.length === 0 ? 0 : avg / reviews.length;

  await Product.findByIdAndUpdate(
    req.query.productId,
    {
      reviews,
      ratings,
      numOfReviews: reviews.length,
    },
    {
      new: true,
      runValidators: true,
      useFindAndModify: false,
    }
  );

  res.status(200).json({
    success: true,
    message: "Review has been deleted successfully",
  });
});
