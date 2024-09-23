const SocketEnum={
    BC_TOPIC:'bc_topic'
}
const HOST_URL = window.location.host;
var socketio = io(HOST_URL);

export async function renderOppTable() {

    var columns = [
        { field: 'id', title: 'Id', align: 'center', width: 20, visible:false  },
        { field: 'name', title: 'Name', align: 'center', width: 20 },
        { field: 'client', title: 'Client', align: 'center', width: 20 },
        { field: 'status', title: 'Status', align: 'center', width: 20  },
        { field: 'dueAt', title: 'Due At', align: 'center', width: 20 },
        { field: 'createdAt', title: 'Created At', align: 'center', width: 20 },
        { field: 'updatedAt', title: 'Updated At', align: 'center', width: 20 },
        { field: 'projectSize', title: 'projectSize', align: 'center', width: 20 },
        { field: 'assignee', title: 'Assignee', align: 'center', width: 20 },
        { field: 'priority', title: 'Priority', align: 'center', width: 20 },
        { field: 'archived', title: 'Archived', align: 'center', width: 20  },
        { field: 'comments', title: 'Comments', align: 'center', width: 20,formatter:commentRowFormatter },
        { field: 'url', title: 'url', align: 'center', width: 20,formatter:urlRowFormatter },
    ]

    //start progress to fetch opportunities 
    $('.progressIssueTable').show();
    const opps  = await bcGetOpps()
     //end progress to fetch opportunities 
    $('.progressIssueTable').hide();

    $(`#oppTable`).bootstrapTable('destroy');
    $(`#oppTable`).bootstrapTable({
        parent: this,
        data: opps,
        editable: true,
        clickToSelect: true,
        cache: false,
        showToggle: false,
        showPaginationSwitch: false,
        pagination: true,
        pageList: [5, 10, 25, 50, 100],
        pageSize: 50,
        pageNumber: 1,
        uniqueId: 'id',
        striped: true,
        search: false,
        showRefresh: false,
        minimumCountColumns: 2,
        smartDisplay: true,
        columns: columns
    });  
  
} 

async function bcGetOpps() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: `/aps/bc/getAllOpps`,
            success: function (res) {
                resolve(res)
            }
        });
    })
}  


export async function bcCreateWebhook(payload) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: `/aps/bc/createWebhook`,
            type: 'POST',
            dataType: 'json',
            data: payload,
            success: function (res) {
                resolve(res)
            }
        });
    })
}  

export async function bcDeleteWebhook(payload) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: `/aps/bc/deleteWebhook`,
            type: 'POST',
            dataType: 'json',
            data: payload,
            success: function (res) {
                resolve(res)
            }
        });
    })
}  


export async function bcUserMe() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/aps/bc/userme',
            success: function (me) {
                resolve(me)
            }
        });
    })
}

function commentRowFormatter(value, row, index) {
    var re = `<ul>`
    value.forEach(async comment => {
      re += `<li>${comment.userName}: ${comment.content}</li>`;
    });
    re += `</ul>` 
    return re
} 


function urlRowFormatter(value, row, index) {
    let re = `<a href="${value}">nagivation url</a>`
    return re
}  

socketio.on(SocketEnum.BC_TOPIC, async (d) => {
    const jsonData = JSON.parse(d)
    
    switch(jsonData.event){
        case 'opportunity.comment.created-1.0':
        case 'opportunity.comment.updated-1.0':
        case 'opportunity.comment.deleted-1.0':
        case 'opportunity.status.updated-1.0':
        case 'opportunity.created-1.0':

            const oppId = jsonData.oppId
            const comments = jsonData.comments  
            let r = $('#oppTable').bootstrapTable('getRowByUniqueId', oppId)
            r.comments = comments
            $('#oppTable').bootstrapTable('filterBy', {id:oppId})
            $('#oppTable').bootstrapTable('filterBy', {})

            break
    }
})