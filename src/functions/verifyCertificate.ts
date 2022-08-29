import { APIGatewayProxyHandler } from "aws-lambda";
import { document } from "../utils/dynamoDBClient";


interface ICertificateData{
    id:string;
    name:string;
    grade:string;
   }

export const handler:APIGatewayProxyHandler = async (event) =>{
    const { id } = event.pathParameters;

    const response = await document.query({
        TableName:"users_certificate",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues:{ ":id":id }
    }).promise();

    const userCertificate = response.Items[0] as ICertificateData;

    if(userCertificate){
        return {
            statusCode:201,
            body:JSON.stringify({
                message:"Certificado Valido",
                name:userCertificate.name,
                url:`https://certificates-serverless-nodejs.s3.amazonaws.com/${id}.pdf`
            })
        }
    }

    return {
        statusCode:400,
        body:JSON.stringify({
            message:"Certificado Invalido"
        })
    }

}