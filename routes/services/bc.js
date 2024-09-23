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
 
const config = require('../../config');  
const { get, post, patch,mydelete } = require('./fetch_common');   

//get user information
async function getUserMe() {
  try {
    const endpoint = config.endpoints.bc.get_user_me
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getUserMe..`)
    return response
      
  } catch (e) {
    console.error(`getUserMe failed: ${e}`)
    return {}
  }
}

async function getBidPackages(projectId) {
  try {
    let endpoint = config.endpoints.bc.get_bid_packages
    endpoint += `?filter[projectId]=${projectId}` 
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getBidPackages..`)
    if(response.results && response.results.length>0)
      return response.results
    else
      return {}
      
  } catch (e) {
    console.error(`getting one bid package failed: ${e}`)
    return {}
  }
}

async function getOneBidPackage(packageId) {
  try {
    let endpoint = config.endpoints.bc.get_bid_package.format(packageId)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getting one bid package..`)
    return response
      
  } catch (e) {
    console.error(`getting one bid package failed: ${e}`)
    return {}
  }
}

async function getOneBid(bidId) {
  try {
    let endpoint = config.endpoints.bc.get_bid.format(bidId)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getting one bid..`)
    return response
      
  } catch (e) {
    console.error(`getting one bid failed: ${e}`)
    return {}
  }
}

async function getOneCompany(companyId) {
  try {
    let endpoint = config.endpoints.bc.get_contacts
    //apply with filters
    endpoint += `?filter[companyId]=${companyId}`
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getOneCompany..`)
    return response
      
  } catch (e) {
    console.error(`getOneCompany failed: ${e}`)
    return {}
  }
}


async function getOneUser(userId) {
  try {
    let endpoint = config.endpoints.bc.get_user.format(userId)
   
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getOneUser..`)
    return response
      
  } catch (e) {
    console.error(`getOneUser failed: ${e}`)
    return {}
  }
}


async function getOneInvitee(bidPackageId,bidderCompanyId,userId) {
  try {
    let endpoint = config.endpoints.bc.get_invites
    endpoint += `?filter[bidPackageId]=${bidPackageId}&filter[bidderCompanyId]=${bidderCompanyId}` 

    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)


    console.log(`getOneInvitee..`)
    return response.results[0].invitees.find(i=>i.userId == userId)
      
  } catch (e) {
    console.error(`getOneInvitee failed: ${e}`)
    return {}
  }
}


async function getInvitees(bidPackageId) {
  try {
    let endpoint = config.endpoints.bc.get_invites
    endpoint += `?filter[bidPackageId]=${bidPackageId}` 

    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)


    console.log(`getInvitees..`)
    return response.results
      
  } catch (e) {
    console.error(`getInvitees failed: ${e}`)
    return {}
  }
}

async function getPackageScopeSpecificForm(bidPackageId) {
  try {
    let endpoint = config.endpoints.bc.get_scope_specific_bid_forms
    endpoint += `?filter[bidPackageId]=${bidPackageId}`
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getPackageScopeSpecificForm..`)
    if(response.results && response.results.length>0)
      return response.results
    else
      return {}      
  } catch (e) {
    console.error(`getPackageScopeSpecificForm failed: ${e}`)
    return {}
  }
}

async function getProjectBidForm(projectId) {
  try {
    let endpoint = config.endpoints.bc.get_project_bid_forms
    endpoint += `?filter[projectId]=${projectId}`
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getProjectBidForm..`)
    if(response.results && response.results.length>0)
      return response.results[0]
    else
      return {}
      
  } catch (e) {
    console.error(`getProjectBidForm failed: ${e}`)
    return {}
  }
}

async function getBids(allBids,filters,limit,cursorState) {
  try {
    let endpoint = cursorState?
                    config.endpoints.bc.get_bids + `?cursorState=${cursorState}&limit=${limit}`:
                    config.endpoints.bc.get_bids + `?limit=${limit}`
     //apply with filters
    Object.keys(filters).forEach(e => {
      endpoint += `&filter[${e}]=${filters[e]}`
    });
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    if (response.results && response.results.length > 0) {
      console.log(`getBids..`)
      allBids = allBids.concat(response.results);
      if (response.pagination.cursorState) {
         return getBids(allBids, filters,limit,response.pagination.cursorState);
      }
      else {
        return allBids
      }
    } else {
      return allBids
    }
  } catch (e) {
    console.error(`getBids failed: ${e}`)
    return {}
  }
}


async function getProjects(allProjects,filters,limit,cursorState) {
  try {
    let endpoint = cursorState?
                    config.endpoints.bc.get_projects + `?cursorState=${cursorState}&limit=${limit}`:
                    config.endpoints.bc.get_projects + `?limit=${limit}`
     //apply with filters
    Object.keys(filters).forEach(e => {
      endpoint += `&filter[${e}]=${filters[e]}`
    });
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    if (response.results && response.results.length > 0) {
      console.log(`getProjects..`)
      allProjects = allProjects.concat(response.results);
      if (response.pagination.cursorState) {
         return getProjects(allProjects, filters,limit,response.pagination.cursorState);
      }
      else {
        return allProjects
      }
    } else {
      return allProjects
    }
  } catch (e) {
    console.error(`getProjects failed: ${e}`)
    return {}
  }
}


async function getOneProject(projectId) {
  try {
    let endpoint = config.endpoints.bc.get_project.format(projectId)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getOneProject..`)
    return response
      
  } catch (e) {
    console.error(`getOneProject failed: ${e}`)
    return {}
  }
}


async function createProject(payload) {
  try {
    let endpoint = config.endpoints.bc.get_projects
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    headers['Content-Type'] = 'application/json' 

    const response = await post(endpoint, headers,JSON.stringify(payload))

    console.log(`createProject..`)
    return response
      
  } catch (e) {
    console.error(`createProject failed: ${e}`)
    return {}
  }
}


async function createPackage(payload) {
  try {
    let endpoint = config.endpoints.bc.get_bid_packages
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    headers['Content-Type'] = 'application/json' 

    const response = await post(endpoint, headers,JSON.stringify(payload))

    console.log(`createPackage..`)
    return response
      
  } catch (e) {
    console.error(`createPackage failed: ${e}`)
    return {}
  }
}
 

async function createPackageScopeSpecificForm(bidPackageId,payload) {
  try {
    let endpoint = config.endpoints.bc.post_scope_specific_bid_forms
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    headers['Content-Type'] = 'application/json' 

    const response = await post(endpoint, headers,JSON.stringify(payload))

    console.log(`createPackageScopeSpecificForm..`)
    if(response.results && response.results.length>0)
      return response.results
    else
      return []    
  } catch (e) {
    console.error(`createPackageScopeSpecificForm failed: ${e}`)
    return {}
  }
}


async function getPackageScopeSpecificFormItems(bidPackageId,formId) {
  try {
    let endpoint = config.endpoints.bc.get_scope_specific_bid_form_line_items.format(formId)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getPackageScopeSpecificFormItems..`)
    if(response.results && response.results.length>0)
    return response.results
      else
    return []            
  } catch (e) {
    console.error(`getPackageScopeSpecificFormItems failed: ${e}`)
    return {}
  }
}


async function createPackageScopeSpecificFormItems(formId,payload) {
  try {
    let endpoint = config.endpoints.bc.post_scope_specific_bid_forms_items.format(formId)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    headers['Content-Type'] = 'application/json' 

    const response = await post(endpoint, headers, JSON.stringify(payload))

    console.log(`createPackageScopeSpecificFormItems..`)
    if(response.results && response.results.length>0)
      return response.results
    else
      return {}      
  } catch (e) {
    console.error(`createPackageScopeSpecificFormItems failed: ${e}`)
    return {}
  }
}


async function updatePackageScopeSpecificFormItems(formId,payload) {
  try {
    let endpoint = config.endpoints.bc.patch_scope_specific_bid_forms_items.format(formId)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    headers['Content-Type'] = 'application/json' 

    const response = await patch(endpoint, headers,JSON.stringify(payload))

    console.log(`updatePackageScopeSpecificFormItems..`)
    if(response.results && response.results.length>0)
      return response.results
    else
      return {}      
  } catch (e) {
    console.error(`updatePackageScopeSpecificFormItems failed: ${e}`)
    return {}
  }
}



async function getOpps() {
  let allOpps = []
  let endpoint = config.endpoints.bc.get_opportunities
        + `?limit=100`
  let header = {
        Authorization: `Bearer ${config.credentials.token_3legged}`
  }
  try { 
        console.log(`Fetching BC Opps... `);
        let onePageOpps = await get(endpoint, header);
        while (onePageOpps.results.length > 0) {
            allOpps = allOpps.concat(onePageOpps.results);

            if(onePageOpps.pagination.nextUrl){
                //move to next page
                endpoint = `https://developer.api.autodesk.com`+ onePageOpps.pagination.nextUrl 
                onePageOpps = await get(endpoint, header);
            }else
              break 
        }
    } catch (e) {
        console.error(`getting issue of  ${projectId} exception: ${e}`)
        return {}
    }
    return allOpps
}


async function getOneOpp(oppId) {
  try {
    let endpoint = config.endpoints.bc.get_opportunitie.format(oppId)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getting one opp..`)
    return response
      
  } catch (e) {
    console.error(`getting one opp failed: ${e}`)
    return {}
  }
}

async function getOppComments(oppId) {
  try {
    let endpoint = config.endpoints.bc.get_opportunity_comments.format(oppId)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getOppComments..`)
    if(response.results && response.results.length>0)
    return response.results
      else
    return []            
  } catch (e) {
    console.error(`getOppComments failed: ${e}`)
    return {}
  }
}


async function getOneComment(oppId,commentId) {
  try {
    let endpoint = config.endpoints.bc.get_opportunity_comment.format(oppId,commentId)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint, headers)

    console.log(`getting one comment of opp..`)
    return response
      
  } catch (e) {
    console.error(`getting one comment of opp failed: ${e}`)
    return {}
  }
}


async function createWebhook(event,payload) {
  try {
    let endpoint = config.endpoints.bc.post_bc_webhook.format(event)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    headers['Content-Type'] = 'application/json' 

    const response = await post(endpoint, headers,JSON.stringify(payload))
    console.log(`createWebhook succeed..`)
       
  } catch (e) {
    console.error(`createWebhook failed: ${e}`)
    return null
  }
}

async function getWebhooks() {
  try {
    let endpoint = config.endpoints.bc.get_bc_webhooks
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)
    const response = await get(endpoint,headers)
    console.log(`getWebhooks succeed..`)

    return response.data
       
  } catch (e) {
    console.error(`getWebhooks failed: ${e}`)
    return null
  }
}


async function deleteWebhook(hookId,event) {
  try {
    let endpoint = config.endpoints.bc.delete_bc_webhook.format(event,hookId)
    const headers = config.endpoints.httpHeaders(config.credentials.token_3legged)

    const response = await mydelete(endpoint, headers)
    console.log(`deleteWebhook succeed..`)
       
  } catch (e) {
    console.error(`deleteWebhook failed: ${e}`)
    return null
  }
}

module.exports = {
  getBids,
  getOneBid,
  getProjectBidForm,
  getPackageScopeSpecificForm,
  getOneBidPackage,
  getBidPackages,
  getUserMe,
  getProjects,
  getOneProject,
  getOneCompany,
  getOneUser,
  getOneInvitee,
  getInvitees,

  createWebhook,
  getWebhooks,
  deleteWebhook,

  createProject,
  createPackage,
  createPackageScopeSpecificForm,
  getPackageScopeSpecificFormItems,
  createPackageScopeSpecificFormItems,
  updatePackageScopeSpecificFormItems,

  getOpps,
  getOneOpp,
  getOppComments,
  getOneComment
} 


