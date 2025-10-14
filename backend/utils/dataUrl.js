const DataUriparser = require('datauri/parser')

const path = require('path')

const GetDataUri =(file)=>{
    const parser = new DataUriparser()

    const extName = path.extname(file.originalname).toString()

    return parser.format(extName, file.buffer).content
}
module.exports = GetDataUri