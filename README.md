# EDA Assignment - Distributed Systems.

__Name:__ Xiang Li

__YouTube Demo link__ - [The URL of the video demonstration of the app.]

## Phase 1

+ Confirmation Mailer - Fully implemented.
  + __Lambda function: mailer.ts__
  + Send an email after uploading a picture
  + Set Confirmation Mailer lambda to be a direct subscriber to this topic
+ Rejection Mailer - Fully implemented.
  + __Lambda function: rejectionMailer.ts__
  + Send rejection emails when files do not have a ".jpeg" or ".png" extension
+ Process Image - Fully implemented.
  + __Lambda function: processImage.ts__
  + Determine the file extension and put the files without ".jpeg" or ".png" extension into DLQ
  + Add the conforming files to DynamoDB

## Phase 2

+ Confirmation Mailer - Fully implemented.
+ Rejection Mailer - Fully implemented.
+ Process Image - Fully implemented.
+ Update Table - Fully implemented.
  + __Lambda function: updateImage.ts__
  + Delete the corresponding file in DynamoDB
  + Subscribe to Topic2
  + Only the "Update Table" function should receive these messages.
+ Delete Image - Fully implemented.
  + __Lambda function: deleteImage.ts__
  + Use the AWS CLI to delete objects from a storage bucket.

## Phase 3 (if relevant)

All user-initiated events are published to a topic and all subscribers add the appropriate filters.

+ Confirmation Mailer - Fully implemented.
+ Process Image - Fully implemented.
+ Update Table - Fully implemented.
+ Delete Mailer - Fully implemented.
  + __Lambda function: deleteMailer.ts__
  + Send an email after deleting a file within DynamoDB.
