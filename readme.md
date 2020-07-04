== Make Images (for your web projects) ==

A simple set of commands and methods to resize and transcode images in the most pain free way possible. 

Apart from the methods in make-image.js that you can use wherever javascript is available, there is also a custom built mini-server that shows all images in a folder and lets you access it with simple parameters.

> yarn start

run the tests

> yarn serve

and put all of your images in folders in the root

> yarn run test

run the tests

see tests.js file for an idea how to use it but be sure to grep the instructions from the code in make-images.js for a more complete picture.

Most of them should make sense but here is a quick summary :

convertImage
- Converts an image to a number of different formats and sizes

convertFolder
- Converts a whole folder of images using convertImage

createIMG
- Create the images and code required to present an image at differing DPIs

createPicture
- Create the images and code required to present a WebP image with fallbacks that uses the same format as createIMG for it's sources

readFolder
- Read the files in a folder of a specific type and infinitely deep