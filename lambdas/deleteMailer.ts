import type { DynamoDBStreamHandler } from "aws-lambda";
// import AWS from 'aws-sdk';
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
  throw new Error(
    "Please add the SES_EMAIL_TO, SES_EMAIL_FROM and SES_REGION environment variables in an env.js file located in the root directory"
  );
}

type ContactDetails = {
  name: string;
  email: string;
  message: string;
  title:string
};

const client = new SESClient({ region: SES_REGION});

export const handler: DynamoDBStreamHandler = async (event: any) => {
  console.log("Event ", event);
  for (const record of event.Records) {
    if(record.eventName === 'INSERT') {
      const imageName = record.dynamodb.NewImage.imageName.S;
      console.log("ImageName ", imageName)
      try {
        const { name, email, message,title }: ContactDetails = {
          name: "The Photo Album",
          email: SES_EMAIL_FROM,
          message: `Your Image has been saved ${imageName}.`,
          title:'Image Added'
        };
        const params = sendEmailParams({ name, email, message,title });
        await client.send(new SendEmailCommand(params));
      } catch (error: unknown) {
        console.log("ERROR is: ", error);
        // return;
      }
    }else if(record.eventName === 'REMOVE') {
      const imageName = record.dynamodb.OldImage.imageName.S;
      console.log("ImageName ", imageName)
      try {
        const { name, email, message,title }: ContactDetails = {
          name: "The Photo Album",
          email: SES_EMAIL_FROM,
          message: `Image(${imageName}) has been removed.`,
          title:'Image Deleted'
        };
        const params = sendEmailParams({ name, email, message,title });
        await client.send(new SendEmailCommand(params));
      } catch (error: unknown) {
        console.log("ERROR is: ", error);
        // return;
      }
    }else if(record.eventName === 'MODIFY') {
      const imageName = record.dynamodb.NewImage.imageName.S;
      console.log("ImageName ", imageName)
      try {
        const { name, email, message,title }: ContactDetails = {
          name: "The Photo Album",
          email: SES_EMAIL_FROM,
          message: `Image(${imageName}) has been updated.`,
          title:'Image Updated'
        };
        const params = sendEmailParams({ name, email, message,title });
        await client.send(new SendEmailCommand(params));
      } catch (error: unknown) {
        console.log("ERROR is: ", error);
        // return;
      }
    }
  }
};

function sendEmailParams({ name, email, message, title }: ContactDetails) {
  const parameters: SendEmailCommandInput = {
    Destination: {
      ToAddresses: [SES_EMAIL_TO],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: getHtmlContent({ name, email, message,title }),
        },
        // Text: {.           // For demo purposes
        //   Charset: "UTF-8",
        //   Data: getTextContent({ name, email, message }),
        // },
      },
      Subject: {
        Charset: "UTF-8",
        Data: title,
      },
    },
    Source: SES_EMAIL_FROM,
  };
  return parameters;
}

function getHtmlContent({ name, email, message, title}: ContactDetails) {
  return `
    <html>
      <body>
        <h2>Sent from: </h2>
        <ul>
          <li style="font-size:18px">👤 <b>${name}</b></li>
          <li style="font-size:18px">✉️ <b>${email}</b></li>
        </ul>
        <p style="font-size:18px">${message}</p>
      </body>
    </html> 
  `;
}
