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
import {
    bcUserMe,
    renderOppTable,
    bcCreateWebhook,
    bcDeleteWebhook
} from './bc.js';

$(document).ready(async () =>{ 

    //delegate click event for sign in button 
    $('#autodeskSigninButton').click(function () {
        $.ajax({
            url: '/aps/auth/login',
            success: function (url) {
                location.href = url;
            }
        });
    }) 

    //delegate click event for creating webhook button
    $('#btnCreateWebhook').click(async e=>{
        let events = []
        $('.form-check .form-check-input').each(function () {
            if($(this)[0].checked) {
              events.push($(this).siblings()[0].textContent.trim());
            }
        });
        const bcUserCompanyId= $('#companyId').text()
        const bcUserId =  $('#bcUserId').text() 

        let phone = $('#phone').val()
        let countryCode = intl.getSelectedCountryData().dialCode
        let email = $('#email').val() 
        let link =  $('#link').val()
        let crm = $('#crm').val()
        let hookAttribute = {
            sms: {
                countryCode:'+' + countryCode,
                phone:phone
            },
            email:email,
            slack:link,
            crm:crm,
            bcUserCompanyId:bcUserCompanyId,
            bcUserId:bcUserId
        } 

        const palyload = {
            events:events,
            bcUserCompanyId:bcUserCompanyId,
            hookAttribute:hookAttribute
        } 
        await bcCreateWebhook(palyload) 
        $('#createWebhookMsg').modal('toggle')        
    })

     //delegate click event for deleting webhook button
    $('#btnDeleteWebhook').click(async e=>{
        let events = []
        $('.form-check .form-check-input').each(function () {
            if($(this)[0].checked) {
              events.push($(this).siblings()[0].textContent.trim());
            }
        });

        const bcUserCompanyId= $('#companyId').text()
        const bcUserId =  $('#bcUserId').text()  

        const palyload = {
            events:events,
            bcUserCompanyId:bcUserCompanyId
        }   
        await bcDeleteWebhook(palyload) 
        $('#deleteWebhookMsg').modal('toggle') 
    }) 


    //initialize intl-tel for phone number input 
    const input = document.querySelector("#phone");
    const intl = window.intlTelInput(input, {
                formatOnDisplay: false,
                nationalMode: false,
                autoPlaceholder: 'aggressive',
                separateDialCode: true,
                preferredCountries: ['US', 'GB'],
            });
    
    const hasToken = await getToken()
    if (hasToken) {
        // yes, it is signed in...
        $('#autodeskSignOutButton').show();
        $('#autodeskSigninButton').hide();
        // prepare sign out
        $('#autodeskSignOutButton').click(function () {
            $('#hiddenFrame').on('load', function (event) {
                location.href = '/aps/auth/signout';
            });
            $('#hiddenFrame').attr('src', 'https://accounts.autodesk.com/Authentication/LogOut');
        })

        //get profile of Autodesk account
        const profile = await userProfile();
        //get user info of BuildingConnected
        const userMe = await bcUserMe();
        //store the info of user in hidden fields
        $('#bcUserId').text(userMe.id);
        $('#companyId').text(userMe.companyId);

        //image of the user 
        const img = '<img src="' + profile.picture + '" height="20px">';
        $('#userInfo').html(img + profile.name);

        //list opportunities this user have access.
        renderOppTable()

    } else {
        $('#autodeskSignOutButton').hide();
        $('#autodeskSigninButton').show();
    }  
 
});
 

//get APS access token
async function getToken() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/aps/auth/token',
            success: function (res) {
                resolve(true)
            },
            error: function (err) {
                resolve(false)
            }
        })
    })
}

//get profile of Autodesk account
async function userProfile() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/aps/user/profile',
            success: function (profile) {
                resolve(profile)
            }
        });
    })
}  