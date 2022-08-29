import { APIGatewayProxyHandler } from "aws-lambda"
import { compile } from "handlebars";
import { document } from "../utils/dynamoDBClient";
import {join } from "path";
import { readFileSync } from "fs";
import { S3 } from "aws-sdk";
import  dayjs from "dayjs";
import chromium from "chrome-aws-lambda";

interface ICertificateData{
 id:string;
 name:string;
 grade:string;
}

interface ITemplate{
 id:string;
 name:string;
 grade:string;
 medal:string;
 data:string;
}

const compileTemplate = async (data: ITemplate) => {
    const filePath = join(process.cwd(),"src","templates","certificate.hbs");
    const html = readFileSync(filePath,"utf-8");
    return compile(html)(data);
}

export const handler:APIGatewayProxyHandler = async (event)=> {
    const { id,name,grade } = JSON.parse(event.body) as ICertificateData;

    const response = await document.query({
        TableName:"users_certificate",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues:{ ":id":id }
    }).promise();

    const userAlreadyExists = response.Items[0];

    if(!userAlreadyExists){
        await document.put({
            TableName:"users_certificate",
            Item:{ id,name,grade,created_at:new Date().getTime()}
        }).promise();    
    }

    const medalPath = join(process.cwd(),"src","templates","selo.png");
    const medal = readFileSync(medalPath,"base64");

    const data: ITemplate = {
        name,
        id,
        grade,
        data: dayjs().format("DD/MM/YYYY"),
        medal
    }

    const content = await compileTemplate(data);

    const browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
    });

    const page = await browser.newPage();

    await page.setContent(content);
    await page.pdf({
        format: "a4",
        landscape: true,
        printBackground: true,
        preferCSSPageSize:true,
        path: process.env.IS_OFFLINE ? "./certificate.pdf" : ""
    });

    await browser.close();

    const s3 = new S3();

   /* await s3.createBucket({
        Bucket:"certificates-serverless-nodejs",

    }).promise();*/

    await s3.putObject({
        Bucket:"certificates-serverless-nodejs",
        Key:`${id}.pdf`,
        ACL: "public-read",
        Body: content,
        ContentType:"application/pdf"
    }).promise();

    return {
        statusCode:201,
        body:JSON.stringify({
            message:"Certificado Gerado Com Sucesso",
            url:`https://certificates-serverless-nodejs.s3.amazonaws.com/${id}.pdf`
        })
    }
}