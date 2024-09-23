/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Developer Acvocacy and Support
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

const express = require('express');
const request = require('request');

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json(); 
const bc_service = require('../services/bc');
const { authRefreshMiddleware } = require('../services/oauth');
const config = require('../../config'); 
const router = express.Router();
const twilio = require('twilio');
const postmark = require("postmark");
const asyncPool = require('tiny-async-pool')
const { get, post, patch } = require('../services/fetch_common');


router.get('/bc/userme', authRefreshMiddleware, async (req, res) => {
    try {
        config.credentials.token_3legged = req.internalOAuthToken.access_token;

        const userMe = await bc_service.getUserMe()
        res.json(userMe).end()

    }
    catch (e) {
        console.error(`/bc/bids:${e.message}`)
        res.end();
    }
});


async function _delay(t, v) {
    return new Promise(function(resolve) {
      setTimeout(resolve.bind(null, v), t);
    });
}

router.get('/bc/getAllOpps', authRefreshMiddleware, async (req, res) => {
    try {
        config.credentials.token_3legged = req.internalOAuthToken.access_token;
        //opp list
        const rawOpps = await bc_service.getOpps()

       var opps = []

        var promiseCreator = async (eachOpp) => {
            await _delay(1000)
            let assignee = eachOpp.members.find(i => i.type == 'ASSIGNEE')
            assignee = assignee ? (await bc_service.getOneUser(assignee.userId)).firstName : 'N/A'
            let client = eachOpp.client ? eachOpp.client.company.name : null

            let comments = await bc_service.getOppComments(eachOpp.id)
            let navigationUrl = `https://app.buildingconnected.com/opportunities/${eachOpp.id}/info`

            opps.push({
                id: eachOpp.id,
                name: eachOpp.name,
                status: eachOpp.submissionState,
                archived: eachOpp.isArchived,
                dueAt: eachOpp.dueAt,
                createdAt: eachOpp.createdAt,
                updatedAt: eachOpp.updatedAt,
                projectSize: eachOpp.projectSize,
                assignee: assignee,
                priority: eachOpp.priority,
                client: client,
                comments: comments,
                url: navigationUrl
            })  
        } 
 
        await asyncPool(2, rawOpps, promiseCreator); 
        res.json(opps).end()
 
        
    }
    catch (e) {
        console.error(`[FAILED]get all opportunities and related data:${e.message}`)
        res.status(500).end()
    }
});

router.post('/bc/createWebhook', authRefreshMiddleware, async (req, res) => {
    config.credentials.token_3legged = req.internalOAuthToken.access_token;
    const payload = req.body

    try {
        await Promise.all(payload.events.map(async (evt) => {
            const webhookPayload = {
                callbackUrl: config.WEBHOOK_CALLBACK + '/aps/bc/webhookevents',
                scope: {
                    companyId: payload.bcUserCompanyId
                },
                hookAttribute: payload.hookAttribute
            }
            const r = await bc_service.createWebhook(evt, webhookPayload)
        }))
        res.json({})
    } catch (e) {
        console.error(`[FAILED]create webhook:${e.message}`)
        res.status(500).end()
    }
})


router.post('/bc/deleteWebhook', authRefreshMiddleware, async (req, res) => {
    config.credentials.token_3legged = req.internalOAuthToken.access_token;
    const payload = req.body
    const bcUserCompanyId = payload.bcUserCompanyId
    const webhookEvents = payload.events
    const allWebhooks = await bc_service.getWebhooks()

    try {
        webhookEvents.forEach(e => {
            let hooksOfEvent = allWebhooks.filter(hook => {
                return hook.system == 'autodesk.construction.bc' && hook.event == e && hook.scope.companyId == bcUserCompanyId
            })
            if (hooksOfEvent) {
                //delete hook
                hooksOfEvent.forEach(async hook => {
                    let r = await bc_service.deleteWebhook(hook.hookId, e)
                })
            }
        })
        res.json({})
    } catch (e) {
        console.error(`[FAILED]delete webhook:${e.message}`)
        res.status(500).end()
    }
})

//event of bid.created-1.0
async function getBidData(data) {

    try {

        let bidData = await bc_service.getOneBid(data.bidId)

        //basic information
        let projectName = await bc_service.getOneProject(bidData.projectId).name
        let bidPackageName = await bc_service.getOneBidPackage(bidData.bidPackageId).name
        let createdBy = await bc_service.getOneUser(bidData.createdBy).email
        let submittedBy = await bc_service.getOneUser(bidData.submittedBy).email
        let bidderCompany = await bc_service.getOneInvitee(bidData.inviteId).bidderCompany.name
        let navigationUrl = `https://app.buildingconnected.com/projects/${bidData.projectId}/bid-packages/${bidData.bidPackageId}/proposals`
        

        return {
            
            //at client side of this sample, it is list of opportunities. GET:Opportunities endpoint does not provide filter by bid id.
            //so, this sample does not notify client side with socket in this version. 
            // socket: { 
            // },
            sms:
                `one bid is created. ${navigationUrl}`,
            email:
                `<html><body> 
                 <h2>one bid is created</h2>
                 <h3>Bid info</h3>
                 <table> 
                    <tr>
                        <td>Project Name</td>
                        <td>${projectName}</td>
                    </tr>
                    <tr>
                        <td>BidPackage Name</td>
                        <td>${bidPackageName}</td>
                    </tr>
                    <tr>
                        <td>Created By</td>
                        <td>${createdBy}</td>
                    </tr>
                    <tr>
                        <td>Submitted By</td>
                        <td>${submittedBy}</td>
                    </tr>
                    <tr>
                        <td>Bidder Company</td>
                        <td>${bidderCompany}</td>
                    </tr> 
                    <tr>
                        <td>Navigation Url</td>
                        <td><a href="${navigationUrl}">Proposal Url</a></td>
                    </tr> 
                 </table> 
                    </body></html> 
                    
                    `,
            slack: {
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "plain_text",
                            text: "*one bid is created. bid info:*"
                        }
                    },

                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Project Name: ${projectName}\nBidPackage Name: ${bidPackageName}\nSubmitted By:${submittedBy}\nBidder Company:${bidderCompany}\nNavigation Url:${navigationUrl}\n`
                        }
                    }
                ]
            },

            //In this version of this sample, it assumes the crm>>HubSpot has table with opportunities. 
            //if you want to connect with bid data, please create table with bid columns in crm>>HubSpot
            // crm: { 
            // }
        } 

    }
    catch (e) {

        return null
    }

} 

//event of opportunity.created-1.0
async function getCreatedOpprtunityData(data) {

    try {
        //basic information
        let oppId = data.opportunityId
        let navigationUrl = `https://app.buildingconnected.com/opportunities/${oppId}/info`
        let oppData = await bc_service.getOneOpp(oppId)
        let oppName = oppData.name
        let companyName = oppData.client && oppData.client.company ? oppData.client.company.name:null
        let leadEmail = oppData.client && oppData.client.lead ? oppData.client.lead.email:null
        let officeName = oppData.client && oppData.client.office ? oppData.client.office.name:null
        let oppSource = oppData.source
        let oppDueAt = oppData.dueAt
        let oppSubmissionState = oppData.submissionState

 
        //for CRM-HubSpot multiple lines
        let allComments = await bc_service.getOppComments(oppId)
        let commentsList = ''
        allComments.forEach(element => {
            commentsList += `${element.userName}:${element.content}\n`
        });

        return {
            socket: {
                event: 'opportunity.created-1.0',
                oppId: oppId,
                comments: allComments
            },
            sms:
                `one opportunity is created. ${navigationUrl}`,
            email:
                `<html><body> 
                 <h2>one comment of opportunity is created</h2>
                 <h3>Opportunity info</h3>
                 <table> 
                    <tr>
                        <td>Name</td>
                        <td>${oppName}</td>
                    </tr>
                    <tr>
                        <td>Client</td>
                        <td>${companyName}</td>
                    </tr>
                    <tr>
                        <td>Leader</td>
                        <td>${leadEmail}</td>
                    </tr>
                    <tr>
                        <td>Office</td>
                        <td>${officeName}</td>
                    </tr>
                    <tr>
                        <td>Source</td>
                        <td>${oppSource}</td>
                    </tr>
                    <tr>
                        <td>Submission</td>
                        <td>${oppSubmissionState}</td>
                    </tr>
                    <tr>
                        <td>Due At</td>
                        <td>${oppDueAt}</td>
                    </tr>
                    <tr>
                        <td>Navigation Url</td>
                        <td><a href="${navigationUrl}">Opportunity Url</a></td>
                    </tr> 
                 </table> 
                    </body></html> 
                    
                    `,
            slack: {
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "plain_text",
                            text: "*one opportunity is created. Opportunity info:*"
                        }
                    },

                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Name: ${oppName}\nClient: ${companyName}\nLeader:${leadEmail}\nOffice:${officeName}\nSource: ${oppSource}\nSubmission:${oppSubmissionState}\nDue At: ${oppDueAt}\nNavigation Url:${navigationUrl}\n`
                        }
                    }
                ]
            },
            crm: {
                event: 'opportunity.created-1.0',
                opportunity_id: oppData.id,
                body: {
                    properties: {
                        opportunity_name: oppName,
                        opportunity_client:companyName,
                        opportunity_lead: leadEmail,
                        opportunity_office: officeName,
                        opportunity_source: oppSource,
                        opportunity_status: oppSubmissionState,
                        opportunity_url: `<a href=\"${navigationUrl}\" rel=\"noopener\">${navigationUrl}</a>`,
                        opportunity_comments: commentsList,
                        opportunity_id: oppData.id
                    }
                }
            }
        } 
    }
    catch (e) {  
        return null
    }

}

//event of opportunity.comment.deleted-1.0
async function getOppDeletedCommentData(data) {

    try {
        let oppId = data.opportunityId
        let commentId = data.commentId
        //The content of the comment. This may include html content like <b></b> or &amp;
        let content = data.content
        //The name of the user who added the comment.
        let userName = data.userName

        //basic information
        let oppData = await bc_service.getOneOpp(oppId)
        let oppName = oppData.name
        let companyName = oppData.client && oppData.client.company ? oppData.client.company.name:null
        let leadEmail = oppData.client && oppData.client.lead ? oppData.client.lead.email:null
        let officeName = oppData.client && oppData.client.office ? oppData.client.office.name:null
        let oppSource = oppData.source
        let oppDueAt = oppData.dueAt
        let oppSubmissionState = oppData.submissionState
        let navigationUrl = `https://app.buildingconnected.com/opportunities/${oppId}/info`

        //for CRM-HubSpot multiple lines
        //in opportunity.comment.deleted-1.0 event, the deleted comment is not available in commentsList
        let allComments = await bc_service.getOppComments(oppId)
        let commentsList = ''
        allComments.forEach(element => {
            commentsList += `${element.userName}:${element.content}\n`
        });


        return {
            socket: {
                event: 'opportunity.comment.deleted-1.0',
                oppId: oppId,
                comments: content
            },
            sms:
                `one comment of opportunity is deleted. ${navigationUrl}`,
            email:
                `<html><body> 
                 <h2>one comment of opportunity is deleted</h2>
                 <h3>Opportunity info</h3>
                 <table> 
                    <tr>
                        <td>Name</td>
                        <td>${oppName}</td>
                    </tr>
                    <tr>
                        <td>Client</td>
                        <td>${companyName}</td>
                    </tr>
                    <tr>
                        <td>Leader</td>
                        <td>${leadEmail}</td>
                    </tr>
                    <tr>
                        <td>Office</td>
                        <td>${officeName}</td>
                    </tr>
                    <tr>
                        <td>Source</td>
                        <td>${oppSource}</td>
                    </tr>
                    <tr>
                        <td>Submission</td>
                        <td>${oppSubmissionState}</td>
                    </tr>
                    <tr>
                        <td>Due At</td>
                        <td>${oppDueAt}</td>
                    </tr>
                    <tr>
                        <td>Navigation Url</td>
                        <td><a href="${navigationUrl}">Opportunity Url</a></td>
                    </tr>
                    <tr>
                        <td>Comment Created By</td>
                        <td>${userName}</td>
                    </tr>
                    <tr>
                        <td>Comment Content</td>
                        <td>${content}</td>
                    </tr>
                 </table> 
                    </body></html>
                    
                    `,
            slack: {
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "plain_text",
                            text: "*one comment of opportunity is deleted. Opportunity info:*"
                        }
                    },

                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Name: ${oppName}\nClient: ${companyName}\nLeader:${leadEmail}\nOffice:${officeName}\nSource: ${oppSource}\nSubmission:${oppSubmissionState}\nDue At: ${oppDueAt}\nNavigation Url:${navigationUrl}\nComment Created By: ${userName}\nComment Content: ${content}\n`
                        }
                    }
                ]
            },
            crm: {
                event: 'opportunity.comment.deleted-1.0',
                opportunity_id: oppData.id,
                body: {
                    properties: {
                        opportunity_name: oppName,
                        opportunity_client: companyName,
                        opportunity_lead: leadEmail,
                        opportunity_office: officeName,
                        opportunity_source: oppSource,
                        opportunity_status: oppSubmissionState,
                        opportunity_url: `<a href=\"${navigationUrl}\" rel=\"noopener\">${navigationUrl}</a>`,
                        opportunity_comments: commentsList,
                        opportunity_id: oppData.id
                    }
                }
            }
        }

    }
    catch (e) {

        return null
    }

}

//event of opportunity.comment.created-1.0
async function getOppCreatedCommentData(data) {

    try {
        let oppId = data.opportunityId
        let commentId = data.commentId

         //basic information
        let oppData = await bc_service.getOneOpp(oppId)
        let oppName = oppData.name
        let companyName = oppData.client && oppData.client.company ? oppData.client.company.name:null
        let leadEmail = oppData.client && oppData.client.lead ? oppData.client.lead.email:null
        let officeName = oppData.client && oppData.client.office ? oppData.client.office.name:null
        let oppSource = oppData.source
        let oppDueAt = oppData.dueAt
        let oppSubmissionState = oppData.submissionState
        let navigationUrl = `https://app.buildingconnected.com/opportunities/${oppId}/info`

        let commentData = await bc_service.getOneComment(oppId, commentId) 

        //for CRM-HubSpot multiple lines
        let allComments = await bc_service.getOppComments(oppId)
        let commentsList = ''
        allComments.forEach(element => {
            commentsList += `${element.userName}:${element.content}\n`
        });

        return {
            socket: {
                event: 'opportunity.comment.created-1.0',
                oppId: oppId,
                comments: allComments
            },
            sms:
                `one comment of opportunity is created. ${navigationUrl}`,
            email:
                `<html><body> 
                 <h2>one comment of opportunity is created</h2>
                 <h3>Opportunity info</h3>
                 <table> 
                    <tr>
                        <td>Name</td>
                        <td>${oppName}</td>
                    </tr>
                    <tr>
                        <td>Client</td>
                        <td>${companyName}</td>
                    </tr>
                    <tr>
                        <td>Leader</td>
                        <td>${leadEmail}</td>
                    </tr>
                    <tr>
                        <td>Office</td>
                        <td>${officeName}</td>
                    </tr>
                    <tr>
                        <td>Source</td>
                        <td>${oppSource}</td>
                    </tr>
                    <tr>
                        <td>Submission</td>
                        <td>${oppSubmissionState}</td>
                    </tr>
                    <tr>
                        <td>Due At</td>
                        <td>${oppDueAt}</td>
                    </tr>
                    <tr>
                        <td>Navigation Url</td>
                        <td><a href="${navigationUrl}">Opportunity Url</a></td>
                    </tr>
                    <tr>
                        <td>Comment Created By</td>
                        <td>${commentData.userName}</td>
                    </tr>
                    <tr>
                        <td>Comment Content</td>
                        <td>${commentData.content}</td>
                    </tr>
                 </table> 
                    </body></html>
                    
                    `,
            slack: {
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "plain_text",
                            text: "*one comment of opportunity is created. Opportunity info:*"
                        }
                    },

                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Name: ${oppName}\nClient: ${companyName}\nLeader:${leadEmail}\nOffice:${officeName}\nSource: ${oppSource}\nSubmission:${oppSubmissionState}\nDue At: ${oppDueAt}\nNavigation Url:${navigationUrl}\nComment Created By: ${commentData.userName}\nComment Content: ${commentData.content}\n`
                        }
                    }
                ]
            },
            crm: {
                event: 'opportunity.comment.created-1.0',
                opportunity_id: oppData.id,
                body: {
                    properties: {
                        opportunity_name: oppName,
                        opportunity_client: companyName,
                        opportunity_lead: leadEmail,
                        opportunity_office: officeName,
                        opportunity_source: oppSource,
                        opportunity_status: oppSubmissionState,
                        opportunity_url: `<a href=\"${navigationUrl}\" rel=\"noopener\">${navigationUrl}</a>`,
                        opportunity_comments: commentsList,
                        opportunity_id: oppData.id
                    }
                }
            }
        }
    }
    catch (e) {

        return null
    }

}

//event of opportunity.comment.updated-1.0
async function getOppUpdatedCommentData(data) {
    try {
        let oppId = data.opportunityId
        let commentId = data.commentId

        //basic information 
        let oppData = await bc_service.getOneOpp(oppId)
        let commentData = await bc_service.getOneComment(oppId, commentId)
        let oppName = oppData.name
        let companyName = oppData.client && oppData.client.company ? oppData.client.company.name:null
        let leadEmail = oppData.client && oppData.client.lead ? oppData.client.lead.email:null
        let officeName = oppData.client && oppData.client.office ? oppData.client.office.name:null
        let oppSource = oppData.source
        let oppDueAt = oppData.dueAt
        let oppSubmissionState = oppData.submissionState
        let navigationUrl = `https://app.buildingconnected.com/opportunities/${oppId}/info`

        //for CRM-HubSpot multiple lines
        let allComments = await bc_service.getOppComments(oppId)
        let commentsList = ''
        allComments.forEach(element => {
            commentsList += `${element.userName}:${element.content}\n`
        });

        return {
            socket: {
                event: 'opportunity.comment.updated-1.0',
                oppId: oppId,
                comments: allComments
            },
            sms:
                `one comment of opportunity is updated. ${navigationUrl}`,
            email:
                `<html><body> 
                 <h2>one comment of opportunity is updated</h2>
                 <h3>Opportunity info</h3>
                  <table> 
                    <tr>
                        <td>Name</td>
                        <td>${oppName}</td>
                    </tr>
                    <tr>
                        <td>Client</td>
                        <td>${companyName}</td>
                    </tr>
                    <tr>
                        <td>Leader</td>
                        <td>${leadEmail}</td>
                    </tr>
                    <tr>
                        <td>Office</td>
                        <td>${officeName}</td>
                    </tr>
                    <tr>
                        <td>Source</td>
                        <td>${oppSource}</td>
                    </tr>
                    <tr>
                        <td>Submission</td>
                        <td>${oppSubmissionState}</td>
                    </tr>
                    <tr>
                        <td>Due At</td>
                        <td>${oppDueAt}</td>
                    </tr>
                    <tr>
                        <td>Navigation Url</td>
                        <td><a href="${navigationUrl}">Opportunity Url</a></td>
                    </tr>
                    <tr>
                        <td>Comment Created By</td>
                        <td>${commentData.userName}</td>
                    </tr>
                    <tr>
                        <td>Comment Content</td>
                        <td>${commentData.content}</td>
                    </tr>
                 </table> 
                    </body></html>
                    
                    `,
            slack: {
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "plain_text",
                            text: "*one comment of opportunity is updated. Opportunity info:*"
                        }
                    },

                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Name: ${oppName}\nClient: ${companyName}\nLeader:${leadEmail}\nOffice:${officeName}\nSource: ${oppSource}\nSubmission:${oppSubmissionState}\nDue At: ${oppDueAt}\nNavigation Url:${navigationUrl}\nComment Created By: ${commentData.userName}\nComment Content: ${commentData.content}\n`
                        }
                    }
                ]
            },
            crm: {
                event: 'opportunity.comment.updated-1.0',
                opportunity_id: oppData.id,
                body: {
                    properties: {
                        opportunity_name: oppName,
                        opportunity_client: companyName,
                        opportunity_lead: leadEmail,
                        opportunity_office: officeName,
                        opportunity_source: oppSource,
                        opportunity_status: oppSubmissionState,
                        opportunity_url: `<a href=\"${navigationUrl}\" rel=\"noopener\">${navigationUrl}</a>`,
                        opportunity_comments: commentsList,
                        opportunity_id: oppData.id
                    }
                }
            }
        }
    }
    catch (e) {

        return null
    }
}

//event of opportunity.status.updated-1.0
async function getOppStatusUpdatedData(data) {
    try {
        let oppId = data.opportunityId
        let newState = data.newState

         //basic information
        let oppData = await bc_service.getOneOpp(oppId)
        let oppName = oppData.name
        let companyName = oppData.client && oppData.client.company ? oppData.client.company.name:null
        let leadEmail = oppData.client && oppData.client.lead ? oppData.client.lead.email:null
        let officeName = oppData.client && oppData.client.office ? oppData.client.office.name:null
        let oppSource = oppData.source
        let oppDueAt = oppData.dueAt
        let oppSubmissionState = oppData.submissionState 
        let navigationUrl = `https://app.buildingconnected.com/opportunities/${oppId}/info`

        //for CRM-HubSpot multiple lines
        let allComments = await bc_service.getOppComments(oppId)
        let commentsList = ''
        allComments.forEach(element => {
            commentsList += `${element.userName}:${element.content}\n`
        });

        return {
            socket: {
                event: 'opportunity.status.updated-1.0',
                oppId: oppId,
                comments: allComments
            },
            sms:
                `status of opportunity is updated to ${newState}. ${navigationUrl}`,
            email:
                `<html><body> 
                 <h2>status of opportunity is updated</h2>
                 <h3>Opportunity info</h3>
                 <table> 
                    <tr>
                        <td>Name</td>
                        <td>${oppName}</td>
                    </tr>
                    <tr>
                        <td>Client</td>
                        <td>${companyName}</td>
                    </tr>
                    <tr>
                        <td>Leader</td>
                        <td>${leadEmail}</td>
                    </tr>
                    <tr>
                        <td>Office</td>
                        <td>${officeName}</td>
                    </tr>
                    <tr>
                        <td>Source</td>
                        <td>${oppSource}</td>
                    </tr> 
                    <tr>
                        <td>Due At</td>
                        <td>${oppDueAt}</td>
                    </tr>
                    <tr>
                        <td>Navigation Url</td>
                        <td><a href="${navigationUrl}">Opportunity Url</a></td>
                    </tr>
                    <tr>
                        <td>New Status</td>
                        <td>${newState}</td>
                    </tr> 
                 </table> 
                    </body></html>
                    
                    `,
            slack: {
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "plain_text",
                            text: "*status of opportunity is updated. Opportunity info:*"
                        }
                    },

                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Name: ${oppName}\nClient: ${companyName}\nLeader:${leadEmail}\nOffice:${officeName}\nSource: ${oppSource}\nSubmission:${oppSubmissionState}\nDue At: ${oppDueAt}\nNavigation Url:${navigationUrl}\nComment Created By: ${commentData.userName}\nComment Content: ${commentData.content}\n`
                        }
                    }
                ]
            },
            crm: {
                event: 'opportunity.status.updated-1.0',
                opportunity_id: oppData.id,
                body: {
                    properties: {
                        opportunity_name: oppName,
                        opportunity_client: companyName,
                        opportunity_lead: leadEmail,
                        opportunity_office: officeName,
                        opportunity_source: oppSource,
                        opportunity_status: oppSubmissionState,
                        opportunity_url: `<a href=\"${navigationUrl}\" rel=\"noopener\">${navigationUrl}</a>`,
                        opportunity_comments: commentsList,
                        opportunity_id: oppData.id
                    }
                }
            }
        }
    }
    catch (e) {

        return null
    }
}

async function sendToSubscribers(data, hookAttribute) {

    //client side 
    global.MyApp.SocketIo.emit("bc_topic", JSON.stringify(data.socket));

    //mobile message
    if (hookAttribute.sms) {
        const sender = config.senderInfo.sms.countryCode + config.senderInfo.sms.phone
        const receiver = hookAttribute.sms.countryCode + hookAttribute.sms.phone
        var client = new twilio(config.senderInfo.sms.twilio.accountSid,
            config.senderInfo.sms.twilio.accountToken)
        try {
            client.messages.create({
                shortenUrls: true,
                body: data.sms,
                to: receiver,
                from: sender
            }, function (err, result) {
                if (result != undefined)
                    console.log('sending message by Twilio succeeded!')
                else
                    console.error('sending message by Twilio failed:' + err)
            });

        } catch (e) {
            console.error('sending message by Twilio exception:' + e)
        }
    }

    //email
    if (hookAttribute.email) {
        var client = new postmark.Client(config.senderInfo.email.apitoken);

        client.sendEmail({
            From: config.senderInfo.email.fromEmail,
            To: hookAttribute.email,
            Subject: 'BuildingConnected Events',
            HtmlBody: data.email
        }).then(function (res) {
            console.log('sending message to email by Postmark succeeded!');
        }).catch(function (err) {
            console.log(`sending message to email by Postmark exception! ${err}`);;
        })
    }

    //slack
    if (hookAttribute.slack) {
        try {
            let endpoint = hookAttribute.slack
            const headers = {
                'Content-Type': 'application/json'
            }
            const response = await post(endpoint, headers, JSON.stringify(data.slack))
            console.log(`sending message to Slack succeeded!`)
        } catch (e) {
            console.error(`sending message to Slack failed: ${e}`)
        }
    }
    //crm>>hubspot
    if (hookAttribute.crm) {
        if (data.crm.event == 'opportunity.comment.created-1.0' || 
            data.crm.event == 'opportunity.comment.updated-1.0' ||
            data.crm.event == 'opportunity.comment.deleted-1.0' ||
            data.crm.event == 'opportunity.comment.created-1.0' ||
            data.crm.event == 'opportunity.status.updated-1.0'  ||
             data.crm.event == 'opportunity.created-1.0'
        ) {
            //if this record exists
            let endpoint = 'https://api.hubapi.com/crm/v3/objects/deals?properties=opportunity_id'
            const headers = {
                Authorization: config.senderInfo.crm.hubspot.token,
                "Content-Type": "application/json"
            }
            let response = await get(endpoint, headers)
            let dealItem = response.results.find(i => i.properties.opportunity_id == data.crm.opportunity_id)
            if (!dealItem) {
                //create new record
                endpoint = 'https://api.hubapi.com/crm/v3/objects/deals'
                let response = await post(endpoint, headers, JSON.stringify(data.crm.body))
                console.log(`create new item with HubSpot Deals succeeded!`)
            } else {
                //patch exisiting record
                endpoint = 'https://api.hubapi.com/crm/v3/objects/deals/' + dealItem.id
                let response = await patch(endpoint,
                    headers, JSON.stringify(data.crm.body))
                console.log(`patch HubSpot Deals succeeded!`)
            }

        }
    }

}

router.post('/bc/webhookevents', jsonParser, async (req, res) => {
    // Best practice is to tell immediately that you got the call
    // so return the HTTP call and proceed with the business logic
    res.status(202).end()

    //now start to handle the data of webhook
    let hook = req.body.hook;
    let payload = req.body.payload;
    let message = null
    switch (hook.event) {
        case 'bid.created-1.0':
            message = await getBidData(payload)
            break
        case 'opportunity.created-1.0':
            message = await getCreatedOpprtunityData(payload)
            break
        case 'opportunity.comment.deleted-1.0':
            message = await getOppDeletedCommentData(payload)
            break
        case 'opportunity.comment.updated-1.0':
            message = await getOppUpdatedCommentData(payload)
            break
        case 'opportunity.comment.created-1.0':
            message = await getOppCreatedCommentData(payload)
            break
        case 'opportunity.status.updated-1.0':
            message = await getOppStatusUpdatedData(payload)
            break
    }

    if (message)
        sendToSubscribers(message, hook.hookAttribute)

})

module.exports = router;
