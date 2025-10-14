const cloudinary = require('cloudinary').v2

cloudinary.config({
    cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
    api_key:process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout:60000
})

const UploadToCloudinary = async(fileUrl)=>{
    try {
        const response = await cloudinary.uploader.upload(fileUrl, { folder: "gramosi_profiles" })

        return response
    } catch (error) {
        console.log(error)
        throw  new Error("Failed to Upload Image to cloudinary")
    }
}

module.exports = {
    cloudinary,
    UploadToCloudinary
}