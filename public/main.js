'use strict';

var COLS_TOTAL = 0;
var LIST_HOLIDAYS = [];
const blocks_in_cluster = 350;
var savePlan = new Map();
var onlyMachine = '';
var mappingPlanRow = new Map();
var lengthPlanRow = new Map();
var elem = document.documentElement;
var INFO_END_DATE;
var ALL_MACHINE = [];
var page_type ='normal';
var SUCCESS_INFO;
var curr_x = 0;
var curr_y = 0;

$(function() {

    $.getJSON("/api/list/opts/1/x", function (data) {
        for (let x = 0; x < data.length; x++) {
          $("#selWC").append("<option>" + data[x].WorkCenter_Id + "</option>");
        }
    });
    
    $.getJSON("/api/list/opts/x/1", function (data) {
        for (let x = 0; x < data.length; x++) {
            $("#selTeam").append("<option>" + data[x].Team_Id + "</option>");
        }
    });

    $.getJSON("/api/list/holidays", function (data) {
        LIST_HOLIDAYS = [];
        for (let x = 0; x < data.length; x++) {
            LIST_HOLIDAYS.push(data[x]);
        }
    });

    $('#wo_lock').click(function() {
        let wo_id = $("#work_order").val();
        let url = "/upd/wo/"+wo_id+"/L";
        $.post(url, function(data) {
            $("#myModal").modal('hide');
            $("#myModalLock").modal('show');
            $("#wo_lock").prop("checked", true);
            $("#wo_lock_unchk").prop("checked", true);
        });
    });

    $('#wo_lock_unchk').click(function(){
        let wo_id = $("#work_order").val();
        let url = "/upd/wo/"+wo_id+"/N";
        $.post(url, function(data) {
            $("#myModal").modal('show');
            $("#myModalLock").modal('hide');
            $("#wo_lock").prop("checked", false);
            $("#wo_lock_unchk").prop("checked", false);
        });
    });
    
    $("input[type='radio']").click(function(){
        let radioValue = $("input[name='rdOpt']:checked").val();
        if (radioValue=='wc'){
            clearTopic();
            $("#divTeam").css('display', 'none');
            $("#divWC").show();
            $("#selWC").val("");
            $("#selTeam").val("");
        } else if (radioValue=='team'){
            clearTopic();
            $("#divWC").css('display', 'none');
            $("#divTeam").show();
            $("#selWC").val("");
            $("#selTeam").val("");
        }
    });

    $("#btn_search").click(function(){
        loadDataGantt();
    });

    $("#btnOkModal").click(function(){
        let woId = $("#work_order").val();
        let headerReal = SUCCESS_INFO.header.header_real;
        let headerVirtual = SUCCESS_INFO.header.header_virtual;
        let setupMachineUsage = SUCCESS_INFO.data.setup_machine;
        let setupHeaderUsage = SUCCESS_INFO.data.setup_headder;
        let headStart = SUCCESS_INFO.data.head_start;
        let headEnd = SUCCESS_INFO.data.head_end;
        let productionTime = SUCCESS_INFO.data.productionTime;
        let pnId = $("#PN_Id").val();
        let planStart = moment($("#plan_start").val(), 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')+'.000';
        let planStop = moment($("#plan_stop").val(), 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')+'.000';
        let subMachine = $("#sub_machine").val();
        let planStartHour = moment($("#plan_start").val(), 'DD/MM/YYYY HH:mm:ss').format('HH');
        let planStopHour = moment($("#plan_stop").val(), 'DD/MM/YYYY HH:mm:ss').format('HH');
        let setupMachine = moment($("#plan_start").val(), 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD');
        let weekNo = $("#Week_No").val();
        let overWeek = $("#Over_Week").val();
        let overPromise = $("#Over_Promise").val();

        // save data
        $.getJSON("/get_promise_date/"+woId, function (data) {
            for (let x = 0; x < data.length; x++) {
                let Promise_Date = data[x].Promise_Date;
                let info = {
                    'PN_Id': pnId,
                    'Plan_Start': planStart,
                    'Plan_Stop': planStop,
                    'WorkOrder_Id': woId,
                    'SubMachine_Id': subMachine,
                    'Plan_Start_Hour': planStartHour,
                    'Plan_Stop_Hour': planStopHour,
                    'Week_No': weekNo,
                    'SetupMachine': setupMachine,
                    'SetupMachine_Usage': setupMachineUsage,
                    'SetupHeader_Usage': setupHeaderUsage,
                    'Production_Usage': productionTime,
                    'HeaderUsage': headEnd,
                    'Header_Real': headerReal,
                    'Header_Virtual': headerVirtual,
                    'Header_Start': headStart,
                    'Header_Stop': headEnd,
                    'Over_Week': overWeek,
                    'Over_Promise': overPromise
                };
                $.post('/save_manual_suggest_plan',{...info}, function(data) {
                    alert("บันทึกข้อมูลเรียบร้อย");
                    $('#btnOkModal').hide();
                    $("#myModal").modal('hide');

                    // ### start suggest plan again ###
                    let wc = '', tm = '';
                    let radioValue = $("input[name='rdOpt']:checked").val();
                    if(radioValue){
                        if(radioValue=='wc'){
                            wc = $("#selWC").val();
                            if(wc==''){
                                alert("กรุณาเลือก Work Center ก่อน");
                                return;
                            }
                        }else if(radioValue=='team'){
                            tm = $("#selTeam").val();
                            if(tm==''){
                                alert("กรุณาเลือก Team ก่อน");
                                return;
                            }
                        }
                    }
                    letSuggestPlanning(wc, tm);
                    // ### finish suggest plan again ###
                });
            }
        })
    });

    $("#btnSuggest").click(function(data) {
        let wc = '', tm = '';
        let radioValue = $("input[name='rdOpt']:checked").val();
        if(radioValue){
            if(radioValue=='wc'){
                wc = $("#selWC").val();
                if(wc==''){
                    alert("กรุณาเลือก Work Center ก่อน");
                    return;
                }
            }else if(radioValue=='team'){
                tm = $("#selTeam").val();
                if(tm==''){
                    alert("กรุณาเลือก Team ก่อน");
                    return;
                }
            }
        }
        letSuggestPlanning(wc, tm);
    });

    $('#btnModalSuggestPlan').click(function() {
        let work_order = $('#work_order').val();
        let wo_model = $('#wo_model').val();
        let header_qty = $('#header_qty').val();
        let plan_start = toDbDateFmt($('#plan_start').val());
        let sub_machine = $('#sub_machine').val();
        let header_start = $('#header_start').val();
        let header_stop = $('#header_stop').val();
        let setup_header = $('#setup_header').val();
        let setup_machine = $('#setup_machine').val();

        if(!work_order){
            alert("กรุณาเลือกข้อมูล Work Order ID");
            return;
        }
        if(!wo_model){
            alert("กรุณาเลือกข้อมูล Work Order Model");
            return;
        }
        if(!header_qty){
            alert("กรุณาเลือกข้อมูล Header Qty");
            return;
        }
        if(!plan_start){
            alert("กรุณาเลือกข้อมูล วันที่เริ่ม Plan");
            return;
        }
        if(!sub_machine){
            alert("กรุณาเลือกข้อมูล Sub Machine");
            return;
        }
        if(!header_start){
            alert("กรุณาเลือกข้อมูล หัวเริ่มต้น");
            return;
        }
        if(!header_stop){
            alert("กรุณาเลือกข้อมูล หัวสิ้นสุด");
            return;
        }
        if(!setup_header){
            alert("กรุณาเลือกข้อมูล setup header");
            return;
        }
        if(!setup_machine){
            alert("กรุณาเลือกข้อมูล setup machine");
            return;
        }

        // calculate planning from suggestion button
        let url = "http://pf.imd.co.th:81/NCI_PPS_PHP/?page=/process/api&proc=cal_manu_plan";
        console.log('Try to connect:'+url)
        url += "&wo_id="+work_order;
        url += "&model_id="+wo_model;
        url += "&head_qty="+header_qty;
        url += "&start_date="+plan_start;
        url += "&submachine_id="+sub_machine;
        url += "&head_start="+header_start;
        url += "&head_end="+header_stop;
        url += "&setup_headder="+setup_header;
        url += "&setup_machine="+setup_machine;

        var jqxhr = $.get(url, function(data) {
        })
        .done(function(info) {

            info = info.substring(1, info.length);
            info = JSON.parse(info);

            SUCCESS_INFO = info;

            // set value
            let plan_stop_res = moment(SUCCESS_INFO.data.end_date, 'YYYY-MM-DD HH:mm:ss');
            $('#plan_stop').val(plan_stop_res.format('DD/MM/YYYY HH:mm:ss'));
            $('#total_date').val(SUCCESS_INFO.data.date_diff);
            $('#header_start').val(SUCCESS_INFO.data.head_start);
            $('#header_stop').val(SUCCESS_INFO.data.head_end);

            // process here
            if(info.status=='not_found_data'||info.data.status != 'found_wo_lock') {
                $('#btnOkModal').show();
            }else{
                $('#btnOkModal').hide();
            }

            // process continue
            if(info.status == 'not_found_data') {
                alert("ประมวลผลสำเร็จ : ไม่มี WO ทับซ้อน");
                if(info.status_header == "adjust"){
                    alert("จำนวนหัวที่ใช้ เปลี่ยนจาก "+info.header.old_head+" เป็น "+info.header.new_head);
                }
            }else if(info.status == 'found_data'){
                if(info.status == "found_wo" || 
                info.status == "not_found_wo" || 
                info.status == "found_wo_lock"){
                    if(info.status != "found_wo_lock"){
                        alert("ประมวลผลสำเร็จ");
                        if(info.status_header = "adjust"){
                            alert("จำนวนหัวที่ใช้ เปลี่ยนจำก "+info.header.old_head +" เป็น "+info.header.new_head);
                        }
                    }else{
                        alert("พบ WO LOCK กรุณำทำกำรเปลี่ยนข้อมูลและ Manual WO ใหม่");
                    }
                }else{
                    alert("ไม่พบข้อมูล กรุณำลองอีกครั้ง");
                }
            }else{
                alert("ไม่พบข้อมูล กรุณำลองอีกครั้ง");
            }
        })
        .fail(function(err) {
            alert('err: '+err);
        })
    });

    $('button.fullscreen').on('click', function(){
        elem = elem || document.documentElement;
        if (!document.fullscreenElement && !document.mozFullScreenElement &&
            !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    });

});

function toDbDateFmt(dt) {
    let dateFmt = dt.split('/');
    let dd = dateFmt[0];
    let mm = dateFmt[1];
    let yyStr = dateFmt[2].split(' ');
    let yy = yyStr[0];
    let tt = yyStr[1];

    return yy+'-'+mm+'-'+dd+' '+tt;
}

function letSuggestPlanning(wc, tm){
    if(wc !='' || tm != ''){
        let url = "http://pf.imd.co.th:81/NCI_PPS_PHP/?page=/process/api&proc=suggestPlan&wc="+wc+"&tm="+tm;
        clearTopic();
        $('#showSuggestPlan').css('display', '');
        get(url).then(function(response) {
            $('#showSuggestPlan').css('display', 'none');
            alert("ประมวลผลสำเร็จ: " + response);
            loadDataGantt();
         }, function(error) {
           alert(error);
         });
    }    
}

function checkHead(){
    let header_start = $('#header_start').val();
    let header_stop = $('#header_stop').val();
    let total = (header_stop - header_start)+1;
    if(total<=0){
        total = 1;
    }
    $('#header_qty').val(total);
} 

function loadDataGantt(){    
    clearTopic() ;
    let work_center_id = $("#selWC").val();
    let team_id = $("#selTeam").val();
    if(work_center_id!=''){
        team_id = 'x';
    }else if(team_id!=''){
        work_center_id = 'x';
    }else{
        work_center_id = '';
        team_id = '';
    }
    if(work_center_id!=''&&team_id!=''){
        $.LoadingOverlay("show");
        getLastPlanDate(work_center_id, team_id)
        getMapSizeWO(work_center_id, team_id);        
        genHeader(work_center_id, team_id);
    }else{
        alert("กรุณาเลือกข้อมูลเพื่อค้นหา");
    }
}

function getLastPlanDate(work_center_id, team_id){
    $.getJSON("/api/plan_enddate/"+work_center_id+"/"+team_id, function (data) {
        for (let x = 0; x < data.length; x++) {
          INFO_END_DATE = data[x];
        }
    })
}

function zoomin() {
    document.body.style.zoom = "100%";
    $('#divMyTable').css('height', '500px');

    $('.modal-content').css('width', '400px');
    $('.modal-content').css('font-size', '12px');
    $('.modal-title').css('font-size', '12px');

    $('.modal-body select').css('font-size', '12px');
    $('#work_order').css('font-size', '12px');
    $('#wo_model').css('font-size', '12px');
    $('#work_center').css('font-size', '12px');
    $('#header_start').css('font-size', '12px');
    $('#header_stop').css('font-size', '12px');
    $('#header_qty').css('font-size', '12px');
    $('#plan_start').css('font-size', '12px');
    $('#plan_stop').css('font-size', '12px');
    $('#total_date').css('font-size', '12px');

    $('#msg_tooltip').css('height', '220px');
    $('#msg_tooltip').css('width', '220px');
    $('#msg_tooltip').css('font-size', '12px');

    page_type ='normal';
}

function zoomout() {
    document.body.style.zoom = "35%";
    $('#divMyTable').css('height', '3000px');

    $('.modal-content').css('width', '1000px');
    $('.modal-content').css('font-size', '36px');
    $('.modal-title').css('font-size', '36px');

    $('.modal-body select').css('font-size', '36px');
    $('#work_order').css('font-size', '36px');
    $('#wo_model').css('font-size', '36px');
    $('#work_center').css('font-size', '36px');
    $('#header_start').css('font-size', '36px');
    $('#header_stop').css('font-size', '36px');
    $('#header_qty').css('font-size', '36px');
    $('#plan_start').css('font-size', '36px');
    $('#plan_stop').css('font-size', '36px');
    $('#total_date').css('font-size', '36px');

    $('#msg_tooltip').css('height', '220px');
    $('#msg_tooltip').css('width', '450px');
    $('#msg_tooltip').css('font-size', '50px');

    page_type ='zoom';
}

function getMapSizeWO(work_center_id, team_id){
    $.post('/api/plan/' + work_center_id + '/' + team_id)
    .done((data) => {
        for (let i = 0; i < data.length; i++) {
            let info = data[i];
            mappingPlanRow.set(info.WorkOrder_Id, getDatePlan(info.Plan_Start, info.Plan_Stop));
            let startFmt = moment(info.Plan_Start).format('DD/MM/YYYY');
            let stopFmt = moment(info.Plan_Stop).format('DD/MM/YYYY');

            let rowSize = parseInt(info.rowSize)/60;

            //check start date
            lengthPlanRow.set(startFmt, rowSize);
            lengthPlanRow.set(stopFmt, rowSize);
        }
    });
}

function getMapSizeWorkMin(machineList){
    $.post('/api/getDateWorkMin', {data: machineList})
    .done((data) => {
        for (let i = 0; i < data.length; i++) {
            let info = data[i];
            let date = moment(info.Shift_Duty_Date).format('DD/MM/YYYY');
            lengthPlanRow.set(date, 16);
        }
    });
}

function clearTopic() {
    onlyMachine = '';

    $("#myTable thead").empty();
    $("#myTable tbody").empty();

    ALL_MACHINE = [];
}

function getModel(map_data) {
    let x_data = new Map();
    for (let m of map_data) {
        let key = m[0].split('_')[0];
        let size = m[1];
        if (x_data.get(key)) {
            x_data.set(key, x_data.get(key) + size);
        } else {
            x_data.set(key, size);
        }
    }
    return x_data;
}

async function genHeader(work_center_id, team_id) {

    $.post('/api/machine/' + work_center_id + '/' + team_id)
    .done((data) => {
        let mTeam = new Map(), mWC = new Map(), mLane = new Map(), mMachine = new Map();
        let key, html_header = '';
        for (let i = 0; i < data.length; i++) {
            let info = data[i];
            let size_machine = info.Max_Header;

            // team
            key = info.Team_Id + '_' + info.SubMachine_Id;
            if (mTeam.get(key)) {
            } else {
                mTeam.set(key, size_machine);
            }
            // wc
            key = info.WorkCenter_Id + '_' + info.SubMachine_Id;
            if (mWC.get(key)) {
            } else {
                mWC.set(key, size_machine);
            }
            // lane
            key = info.Lane_Id + '_' + info.Team_Id + '_' + info.SubMachine_Id + '_' + info.WorkCenter_Id;
            if (mLane.get(key)) {
            } else {
                mLane.set(key, size_machine);
            }
            // machine
            key = info.SubMachine_Id;
            if (mMachine.get(key)) {
            } else {
                mMachine.set(key, info);
            }
        }

        // Team
        html_header += '<tr><th style="text-align:center;background:#e8e8e8;">Team</th>'
        for (let m of getModel(mTeam)) {
            html_header += "<th style='text-align: center;background:rgb(189, 62, 136);z-index: 5;' colspan='" + m[1] + "'>" + m[0] + "</th>";
        }
        html_header += '</tr>';

        // Work Center
        html_header += '<tr><th style="text-align:center;background:#e8e8e8;">WC</th>'
        for (let m of getModel(mWC)) {
            html_header += "<th style=\"text-align: center;background: rgb(130, 181, 249);z-index: 5;\" colspan='" + m[1] + "'>" + m[0] + "</th>";
        }
        html_header += '</tr>';

        // Lane
        let x_data = new Map();
        for (let m of mLane) {
            let key = m[0].split('_')[0] + '_' + m[0].split('_')[1] + '_' + m[0].split('_')[3];
            let size = m[1];
            if (x_data.get(key)) {
                x_data.set(key, x_data.get(key) + size);
            } else {
                x_data.set(key, size);
            }
        }
        html_header += '<tr><th style="text-align:center;background:#e8e8e8;">Lane</th>'
        for (let m of x_data) {
            html_header += "<th style=\"text-align: center;background: white;z-index: 5;\" colspan='" + m[1] + "'>" + m[0].split('_')[0] + "</th>";
        }
        html_header += '</tr>';

        // Sub Machine
        let allSub = [];
        let allHeader = [];
        html_header += '<tr><th style="text-align:center;background-color:#e8e8e8;white-space: nowrap;">Sub Machine</th>'
        for (let m of mMachine) {
            html_header += "<th style=\"text-align: center; white-space: nowrap;z-index: 5;background-color:#e8e8e8;\" colspan='" + m[1].Max_Header + "'><a style=\"text-decoration:none;\" href=\"javascript:loadColsData('" + m[0] + "')\">" + m[0] + "</a></th>";
            allSub.push(m[1].SubMachine_Id);
        }
        html_header += '</tr>';

        // Slot
        html_header += '<tr><th style="text-align:center;background-color:#e8e8e8;" width="10%">&nbsp;</th>';
        let machineList = "";
        for (let m of mMachine) {
            let info = m[1];
            machineList += "'"+info.SubMachine_Id+"',";
            for (let y = 0; y < info.Max_Header; y++) {
                html_header += '<th style="text-align:center;background-color:#e8e8e8;z-index: 5;">' + (y + 1) + '</th>';
            }

            if(info.Header_Real>0){
                let countHeader = 0;
                for (let y = 0; y < info.Header_Real; y++) {
                    allHeader.push(info.SubMachine_Id + '_' + (countHeader + 1) + '_N_'+info.Max_Header);
                    countHeader++;
                }
                for (let y = 0; y < info.Header_Virtual; y++) {
                    allHeader.push(info.SubMachine_Id + '_' + (countHeader + 1) + '_Y_'+info.Max_Header);
                    countHeader++;
                }
                for (let y = countHeader; y < info.Max_Header; y++) {
                    allHeader.push(info.SubMachine_Id + '_' + (countHeader + 1) + '_X_'+info.Max_Header);
                    countHeader++;
                }
            }else{
                for (let y = 0; y < info.Max_Header; y++) {
                    allHeader.push(info.SubMachine_Id + '_' + (y + 1) + '_X_'+info.Max_Header);
                }
            }
        }
        machineList += "''";
        html_header += '</tr>';
        $('#myTable thead').html(html_header);

        // generate body 1 row
        let strData = '<tr>';
        strData += '<td col_id="0" machine="" virtual="" max_head="" style="vertical-align: top; z-index: 5;">&nbsp;</td>';
        let tmp = '';
        let count = 0;
        for (let j = 0; j < allHeader.length; j++) {
            let machine = allHeader[j].split('_')[0];
            let isVirtual = allHeader[j].split('_')[2];
            let maxHeader = allHeader[j].split('_')[3];
            if(tmp===''){
                tmp = machine;
            }
            if(tmp!==machine){
                tmp = machine;
                count = 1;
            }else{
                count++;
            }
            strData += '<td col_id="'+count+'" machine="'+machine+'" virtual="'+isVirtual+'" max_head="'+maxHeader+'" style="vertical-align: top;">&nbsp;</td>';
        }
        strData += '</tr>';
        COLS_TOTAL = allHeader.length;
        $('#myTable tbody').append(strData);

        ALL_MACHINE = mMachine;

        getMapSizeWorkMin(machineList);

        generateGanttChart();
    });
}

function getHoliday(currDate){
    let currDateFmt = currDate.format('DD/MM/YYYY');
    let holiday = currDate.format('dddd');
    if(holiday=='Sunday'){
        return 'Sunday';
    }else{
        for(let i=0;i<LIST_HOLIDAYS.length;i++){
            let holi_dt = LIST_HOLIDAYS[i].Holiday_date;
            let holiday_date = moment(holi_dt).format('DD/MM/YYYY');
            if(currDateFmt===holiday_date){
                return 'Holiday';
            }
        }
    }

    return '';
}

async function generateGanttChart() {
    let work_center_id = $("#selWC").val();
    let team_id = $("#selTeam").val();
    if(work_center_id!=''){
        team_id = 'x';
    }else if(team_id!=''){
        work_center_id = 'x';
    }else{
        return;
    }

    $.post('/api/plan/' + work_center_id + '/' + team_id)
    .done((data) => {

        if(data.length>0){
            let info_end = INFO_END_DATE;
            if(!info_end.Plan_Stop){
                getLastPlanDate(WorkCenter_Id, team_id);
            }
            let currDate = moment();
            let endDate = moment(info_end.Plan_Stop).add(1, 'days').format('DD/MM/YYYY');

            savePlan = new Map();
            for(let i=0;i<2500;i++){
                let currFmt = currDate.format('DD/MM/YYYY');
                let arrWo = [];
                for(let i=0;i<data.length;i++){
                    let info = data[i];
                    let startFmt = moment(info.Plan_Start).format('DD/MM/YYYY');
                    if(currFmt==startFmt){
                        arrWo.push(info);
                    }
                }
                if(arrWo.length==0){
                    let holiday = getHoliday(currDate);
                    savePlan.set(currFmt, holiday);
                }else{
                    savePlan.set(currFmt, arrWo);
                }
                if(currFmt===endDate){
                    break;
                }
                currDate.add(1, 'days');
            }

            pumpDivHtml();

            $("#myTable").tableHeadFixer({ "left": 1 });
            $.LoadingOverlay("hide");

            // add event show tooltip
            addTooltipMsgEvent();
        }else{
            clearTopic();
            $('thead').html('<div align="center" style="padding: 20px;">Not found data to plan !</div>');
            $.LoadingOverlay("hide");
        }
        
    });
}

function loadColsData(machineId){
    onlyMachine = machineId;
    pumpDivHtml();
    addTooltipMsgEvent();
}

function getDatePlan(day_start, day_stop) {
    let row_start = 0;
    let start_full = moment(day_start).add(-7, 'hours');  
    let stop_full = moment(day_stop).add(-7, 'hours');
  
    for (let i=0; i<1000; i++) {
      let start_fmt_time  = start_full.format('HH:mm:ss');
      let dddd  = start_full.format('dddd');
  
      let start_fmt  = start_full.format('DD/MM/YYYY HH:mm:ss');
      let stop_fmt   = stop_full.format('DD/MM/YYYY HH:mm:ss');
  
      if (start_fmt == stop_fmt) {
        row_start++;
        break;
      }
  
      if(i==0&&start_fmt_time=='00:00:00'){
        row_start++;
      }
  
      if(start_fmt_time=='00:00:00'){
        start_full.add(1, 'hours');
        continue;
      }
  
      if(start_fmt_time=='08:00:00'||dddd=='Sunday') {      
        start_full.add(1, 'days');
        start_full.set({hour:0,minute:0,second:0,millisecond:0});      
      } else {
        start_full.add(1, 'hours');
      }

      if(row_start>5){
          return row_start;
      }
  
      row_start++;
    }
  
    return row_start;
}

function addModal(wo){
    return ' id="'+wo+'" data-toggle="modal" data-target="#myModal" onclick="showModalData(this);" ';
}

function printWritePlan(info){
    let atp = '';
    if(info.ATP==1){
        atp += '-atp';
    }

    let hours_plus = Math.ceil(info.Production_Usage / 60);

    let clickModal =  addModal(info.WorkOrder_Id);
    let sizeRows = mappingPlanRow.get(info.WorkOrder_Id);
    let totalSizeComp = info.SM_U-sizeRows;

    let mini = '';
    if(totalSizeComp>=0){
        let div_html = '';
        if((info.Over_Week == 1)||(info.Over_Promise == 1)||(info.Plan_Lock == 'L')){            
            if (info.Over_Week == 1){
                div_html += '<span class="fa-stack fa-1x" style="height: 20;"><i class="fa fa-calendar-o"></i><span class="fa fa-stack-1x">7</span></span>';
            }
            if (info.Over_Promise == 1){
                div_html += '<span class="fa-stack fa-1x" style="height: 20;"><i class="fa fa-calendar-o"></i><span class="fa fa-stack-1x">P</span></span>';
            }
            if (info.Plan_Lock == 'L'){
                div_html += '<span class="fa-stack fa-1x" style="height: 20;"><i class="fa fa-lock"></i></span>';
            }
        }
        mini += '<div '+clickModal+' class="mydiv-plan-over'+atp+' '+info.WorkOrder_Id+'" style="height: 20px;">'+div_html+'</div>';
        mini += '<span class="over-text-more'+atp+' '+info.WorkOrder_Id+'">&nbsp;' + info.Model_Id + ' ('+hours_plus+')</span>';
    }

    let mappingWhitePlan = [];
    if (info.SetupMachine_Usage > 0){
        let showHeader = '';
        let count_hours = Math.ceil(info.SetupMachine_Usage/60);
        for(let i=0;i<count_hours;i++){
            if(i==0){
                showHeader = info.SetupMachine_Usage+mini;
                mappingWhitePlan.push('<div '+clickModal+' class="mydiv-plan-setup-machine'+atp+' '+info.WorkOrder_Id+'" style="height: 20px;">'+showHeader+'</div>');                                
                mini = '';
            }else{
                showHeader = '&nbsp;';
                mappingWhitePlan.push('<div '+clickModal+' class="mydiv-plan-setup-machine-bottom'+atp+' '+info.WorkOrder_Id+'">'+showHeader+'</div>');
            }
        }
    }
    if(info.SetupHeader_Usage>0){
        mappingWhitePlan.push('<div '+clickModal+' class="mydiv-plan-setup-header'+atp+' '+info.WorkOrder_Id+'">'+info.SetupHeader_Usage+mini+'</div>');
        mini = '';
    }
    if((info.Over_Week == 1)||(info.Over_Promise == 1)||(info.Plan_Lock == 'L')){
        let div_html = '';
        if (info.Over_Week == 1){
            div_html += '<span class="fa-stack fa-1x"><i class="fa fa-calendar-o"></i><span class="fa fa-stack-1x">7</span></span>';
        }
        if (info.Over_Promise == 1){
            div_html += '<span class="fa-stack fa-1x"><i class="fa fa-calendar-o"></i><span class="fa fa-stack-1x">P</span></span>';
        }
        if (info.Plan_Lock == 'L'){
            div_html += '<span class="fa-stack fa-1x"><i class="fa fa-lock"></i></span>';
        }
        mappingWhitePlan.push('<div '+clickModal+' class="mydiv-plan-over'+atp+' '+info.WorkOrder_Id+'" style="height: 20px;">'+div_html+'</div>');
    }
    let vertext_html = '';
    let show_vertical = 'writing-mode: vertical-rl;';
    if(sizeRows<=5){
        show_vertical = '';
    }
    vertext_html += '<span style="white-space: nowrap; '+show_vertical+' text-orientation: mixed; text-align: left;">' + info.Model_Id + ' ('+hours_plus+')</span>';
    mappingWhitePlan.push('<div '+clickModal+' class="mydiv-plan-over-text'+atp+' '+info.WorkOrder_Id+'" style="height: 20px;">'+vertext_html+'</div>');

    return mappingWhitePlan;
}

function getLengthPlanRow(dateAt, machine_id){
    if(lengthPlanRow.get(dateAt)){
        return lengthPlanRow.get(dateAt);
    }else{
        return 8;
    }
}

function checkColAt(col_id, info) {
    let headerReal = (info.Header_Real+info.Header_Start)-1;
    if(col_id <= headerReal){
        return 'R';
    }else if(col_id > headerReal && col_id <= (headerReal + info.Header_Virtual)){
        return 'Y';
    }else if(col_id > (headerReal + info.Header_Virtual)){
        return 'X';
    }
}

function pumpDivHtml(){
    let clickModal;
    
    $("#myTable").find('> tbody > tr').each(function(row_id){
        
        $(this).find('> td').each(function(col_id){
            let machine = $(this).attr('machine');
            let virtual = $(this).attr('virtual');
            let max_head = $(this).attr('max_head');
            let columnsAt = $(this).attr('col_id');

            if(onlyMachine!==''){
                if(machine!==onlyMachine){
                    return;
                }
            }
            
            if(row_id==0&&col_id==0){// only first column [0]
                let data = [];
                for(let m of savePlan){
                    let dateAt = m[0];
                    let infoArr= m[1];
                    let row_default = getLengthPlanRow(dateAt, '')-1;
                    if(infoArr!==''&&infoArr!=='Sunday'&&infoArr!=='Holiday'){
                        data.push('<div class="mydiv-date">'+dateAt+'</div>');
                        for(let i=0;i<row_default;i++){
                            data.push('<div class="mydiv-date-bottom">&nbsp;</div>');
                        }
                    }else if(infoArr==='Sunday'||infoArr==='Holiday'){
                        data.push('<div class="mydiv-date-sunday">'+dateAt+'</div>');
                    }else{
                        data.push('<div class="mydiv-date">'+dateAt+'</div>');
                        for(let i=0;i<row_default;i++){
                            data.push('<div class="mydiv-date-bottom">&nbsp;</div>');
                        }
                    }
                }

                $(this).html('<div id="contentArea'+col_id+'" class="clusterize-content"></div>');
                new Clusterize({ rows: data, scrollId: 'myTable', contentId: 'contentArea'+col_id, blocks_in_cluster: blocks_in_cluster});
            }else{// other columns [n]
                if(onlyMachine===''){
                    let max_head_int = parseInt(max_head);
                    if(max_head_int>100 && col_id>max_head_int){
                        return ;
                    }
                }

                let data = [];
                let planCount = 0;
                let planCountStr = '&nbsp;';                
                let info;
                let atp = '';

                let arrBeforeGantt = '';
                for(let m of savePlan){
                    let dateCheckFmt = m[0];
                    let dateAt = moment(m[0], 'DD/MM/YYYY');
                    let infoArr= m[1];
                    let row_default = getLengthPlanRow(dateCheckFmt, machine);
                    if(infoArr!==''&&infoArr!=='Sunday'&&infoArr!=='Holiday'){//draw gantt chart
                        let showWO = '';
                        let infoTmp = [];

                        for(let a=0;a<infoArr.length;a++){
                            if(infoArr[a].SubMachine_Id===machine){
                                showWO = infoArr[a].WorkOrder_Id;
                                infoTmp.push(infoArr[a]);
                            }
                        }
                        for(let i=0;i<row_default;i++){//start row_default
                            let found_wo = false;
                            for(let j=0;j<infoTmp.length;j++){
                                let Plan_Start_Hour = infoTmp[j].Plan_Start_Hour;
                                if(showWO!==''&&i==Plan_Start_Hour){
                                    showWO = infoTmp[j].WorkOrder_Id;
                                    info = infoTmp[j];//object workorder                                    
                                    if(info.ATP==1){
                                        atp = '-atp';
                                    }else{
                                        atp = '';
                                    }
                                    arrBeforeGantt = printWritePlan(info);
                                    clickModal =  addModal(info.WorkOrder_Id);
                                    found_wo = true;
                                    if(col_id>=info.Header_Start&&col_id<=info.Header_Stop){
                                        break;
                                    }                                    
                                }
                            }

                            if(found_wo==true){
                                let chkMachine = checkColAt(columnsAt, info);
                                if(chkMachine==='Y'){
                                    data.push('<div virtual="Y" class="mydiv-plan-virtual '+info.WorkOrder_Id+'">&nbsp;</div>');
                                }else if(chkMachine==='X'){
                                    data.push('<div class="mydiv">'+planCountStr+'</div>');                                  
                                }else{
                                    if(arrBeforeGantt.length>0){
                                        if(arrBeforeGantt[0]!==''){
                                            data.push(arrBeforeGantt[0]);
                                        }
                                        arrBeforeGantt.splice(0,1);
                                    }else{
                                        let show_plan_wo_str = info.WorkOrder_Id;
                                        data.push('<div '+clickModal+' class="mydiv-plan'+atp+' '+info.WorkOrder_Id+'">'+show_plan_wo_str+'</div>');
                                    }                                    
                                }
                            }else{
                                if(info){
                                    let chkMachine = checkColAt(columnsAt, info);

                                    let plan_stop_date = moment(info.Plan_Stop);
                                    let plan_stop_date_fmt = plan_stop_date.format('DD/MM/YYYY');
                                    let plan_stop_hour = info.Plan_Stop_Hour;
                                    let dateAt_fmt = dateAt.format('DD/MM/YYYY');
                                    if(dateAt<plan_stop_date){
                                        if(chkMachine==='Y'){
                                            if(dateAt_fmt==plan_stop_date_fmt && i >= info.Plan_Stop_Hour){
                                                data.push('<div class="mydiv">'+planCountStr+'</div>');
                                            }else{
                                                data.push('<div virtual="Y" class="mydiv-plan-virtual-bottom '+info.WorkOrder_Id+'">&nbsp;</div>');
                                            }
                                        }else if(chkMachine==='X'){
                                            data.push('<div class="mydiv">'+planCountStr+'</div>');
                                        }else{
                                            if(dateAt_fmt!==plan_stop_date_fmt){
                                                if(arrBeforeGantt.length>0){
                                                    if(arrBeforeGantt[0]!==''){
                                                        data.push(arrBeforeGantt[0]);
                                                    }
                                                    arrBeforeGantt.splice(0,1);
                                                }else{
                                                    if(dateAt_fmt==plan_stop_date_fmt && i >= info.Plan_Stop_Hour){
                                                        data.push('<div class="mydiv">'+planCountStr+'</div>');
                                                    }else{
                                                        data.push('<div '+clickModal+' class="mydiv-plan-bottom'+atp+' '+info.WorkOrder_Id+'">&nbsp;</div>');
                                                    }
                                                }
                                            }else if(dateAt_fmt===plan_stop_date_fmt&&i<plan_stop_hour){
                                                if(arrBeforeGantt.length>0){
                                                    if(arrBeforeGantt[0]!==''){
                                                        data.push(arrBeforeGantt[0]);
                                                    }
                                                    arrBeforeGantt.splice(0,1);
                                                }else{
                                                    if(dateAt_fmt==plan_stop_date_fmt && i >= info.Plan_Stop_Hour){
                                                        data.push('<div class="mydiv">'+planCountStr+'</div>');
                                                    }else{
                                                        data.push('<div '+clickModal+' class="mydiv-plan-bottom'+atp+' '+info.WorkOrder_Id+'">&nbsp;</div>');
                                                    }
                                                }
                                            }else{
                                                data.push('<div class="mydiv">'+planCountStr+'</div>');
                                            }
                                        }
                                    }else{
                                        data.push('<div class="mydiv">'+planCountStr+'</div>');
                                    }
                                }else{
                                    data.push('<div class="mydiv">'+planCountStr+'</div>');
                                }
                            }

                            planCount++;
                        }//end row_default
                    }else if(infoArr==='Sunday'||infoArr==='Holiday'){
                        if(info){
                            let chkMachine = checkColAt(columnsAt, info);

                            let dateChkStart = moment(info.Plan_Start);
                            let dateChkStop = moment(info.Plan_Stop);
                            if(chkMachine==='Y'){
                                if(dateAt < dateChkStart || dateAt > dateChkStop){
                                    data.push('<div class="mydiv-date-sunday">&nbsp;</div>');
                                }else{
                                    data.push('<div virtual="Y" class="mydiv-plan-virtual-bottom '+info.WorkOrder_Id+'">&nbsp;</div>');
                                }
                            }else if(chkMachine==='X'){
                                data.push('<div class="mydiv-date-sunday">'+planCountStr+'</div>');
                            }else{
                                if(arrBeforeGantt.length>0){
                                    if(dateAt < dateChkStart || dateAt > dateChkStop){
                                        data.push('<div class="mydiv-date-sunday">&nbsp;</div>');
                                    }else{
                                        if(arrBeforeGantt[0]!==''){
                                            data.push(arrBeforeGantt[0]);
                                        }
                                        arrBeforeGantt.splice(0,1);
                                    }
                                }else{
                                    if(dateAt < dateChkStart || dateAt > dateChkStop){
                                        data.push('<div class="mydiv-date-sunday">&nbsp;</div>');
                                    }else{
                                        data.push('<div '+clickModal+' class="mydiv-plan-bottom'+atp+' '+info.WorkOrder_Id+'">&nbsp;</div>');
                                    }
                                }
                            }
                        }else{
                            data.push('<div class="mydiv-date-sunday">'+planCountStr+'</div>');
                        }
                        planCount++;
                    }else{
                        if(info){
                            let chkMachine = checkColAt(columnsAt, info);

                            for(let i=0;i<row_default;i++){
                                let plan_stop_date = moment(info.Plan_Stop);
                                let plan_stop_date_fmt = plan_stop_date.format('DD/MM/YYYY');
                                let dateAt_fmt = dateAt.format('DD/MM/YYYY');
                                if(dateAt<plan_stop_date){
                                    if(chkMachine==='Y'){
                                        if(dateAt_fmt==plan_stop_date_fmt && i >= info.Plan_Stop_Hour){
                                            data.push('<div class="mydiv">'+planCountStr+'</div>');
                                        }else{
                                            data.push('<div virtual="Y" class="mydiv-plan-virtual-bottom '+info.WorkOrder_Id+'">&nbsp;</div>');
                                        }
                                    }else if(chkMachine==='X'){
                                        data.push('<div class="mydiv">'+planCountStr+'</div>');
                                    }else{
                                        if(arrBeforeGantt.length>0){
                                            if(arrBeforeGantt[0]!==''){
                                                data.push(arrBeforeGantt[0]);
                                            }
                                            arrBeforeGantt.splice(0,1);
                                        }else{
                                            if(dateAt_fmt==plan_stop_date_fmt && i >= info.Plan_Stop_Hour){
                                                data.push('<div class="mydiv">'+planCountStr+'</div>');
                                            }else{
                                                data.push('<div '+clickModal+' class="mydiv-plan-bottom'+atp+' '+info.WorkOrder_Id+'">&nbsp;</div>');
                                            }
                                        }
                                    }
                                }else{
                                    data.push('<div class="mydiv">'+planCountStr+'</div>');
                                }
                                planCount++;
                            }
                        }else{
                            for(let i=0;i<row_default;i++){
                                data.push('<div class="mydiv">'+planCountStr+'</div>');                                
                                planCount++;
                            }
                        }                        
                    }
                }

                $(this).html('<div id="contentArea'+col_id+'" class="clusterize-content"></div>');
                new Clusterize({ rows: data, scrollId: 'myTable', contentId: 'contentArea'+col_id, blocks_in_cluster: blocks_in_cluster });
            }// other columns
        });
    });
}

function getSizeRow(info){
    let size_row = 8;
    if(info.Plan_Start_Hour>8||info.Plan_Stop_Hour>8){
        size_row = 16;
    }

    return size_row;
}

function genDiv(css_class){
    let table_data = '';
    for(let i=0;i<100;i++){
        table_data += '<div class="'+css_class+'">x</div>';
    }
    return table_data;
}

function addTooltipMsgEvent(){
    let work_center_id = $("#selWC").val();
    let team_id = $("#selTeam").val();
    if(work_center_id!=''){
        team_id = 'x';
    }else if(team_id!=''){
        work_center_id = 'x';
    }else{
        work_center_id = '';
        team_id = '';
    }
    if(work_center_id==''&&team_id==''){
        return;
    }
    $.post('/api/plan/' + work_center_id + '/' + team_id)
    .done((data) => {
        for (let i = 0; i < data.length; i++) {
            let info = data[i];
            // add event
            $('.'+info.WorkOrder_Id).mouseover(function (e){
                // tooltip.hide();
                $('.'+info.WorkOrder_Id).css('background-color', '#eeeeee');
                $('.'+info.WorkOrder_Id).css('cursor', 'pointer');

                $('#msg_tooltip').css('display', 'block');
                if(page_type==='zoom'){
                    let xxxx = e.clientX*2;
                    let yyyy = e.clientY*2;
                    if(xxxx===curr_x){
                        xxxx = xxxx-100;
                    }
                    if(yyyy===curr_y){
                        yyyy = yyyy-100;
                    }
                    $('#msg_tooltip').css('left', xxxx);
                    $('#msg_tooltip').css('top', yyyy);
                    curr_x = xxxx;
                    curr_y = yyyy;
                }else{
                    $('#msg_tooltip').css('top', e.clientY + 20);
                    $('#msg_tooltip').css('left', e.clientX + 10);
                }
                
                let showWoType = 'Real Head';
                if($(this).attr('virtual')){
                    showWoType = 'Virtual Head';
                }

                let add_tooltip = '';
                add_tooltip += '<div style="font-size: 14px; width: 420px; height: 220px; padding: 10px; background-color: black; color: white;">';
                add_tooltip += '<div style="height: 25px;">WorkOrder : '+info.WorkOrder_Id+'</div>';
                add_tooltip += '<div style="height: 25px;">Model : '+info.Model_Id+'</div>';
                add_tooltip += '<div style="height: 25px;">Item : '+info.Item_Id+'</div>';
                add_tooltip += '<div style="height: 25px;">Header Type : '+showWoType+'</div>';
                add_tooltip += '<div style="height: 25px;">Setup Machine : '+info.SetupMachine_Usage+'</div>';
                add_tooltip += '<div style="height: 25px;">Setup Header : '+info.SetupHeader_Usage+'</div>';
                add_tooltip += '<div style="height: 25px;">Item Qty : '+info.HeaderUsage+'</div>';
                add_tooltip += '<div style="height: 25px;">Production Time : '+info.Production_Usage;
                add_tooltip += '</div>';

                // tooltip.pop(this, add_tooltip)
                
                $("#msg_tooltip").html(add_tooltip);
            });

            $('.'+info.WorkOrder_Id).mouseout(function (){
                $('#msg_tooltip').css('display', 'none');
                $('.'+info.WorkOrder_Id).css("background-color", "");
                // tooltip.hide();
            });
        }
    });    
}

function showModalData(m) {
    $.getJSON("/find_wo/"+m.id, function (data) {
      for (let x = 0; x < data.length; x++) {
        let rs = data[x];
        if(rs.Plan_Lock=='L'){
            $("#myModal").modal('hide');
            $("#myModalLock").modal('show');
            $("#wo_lock").prop('checked', true);
            $("#wo_lock_unchk").prop('checked', true);
        }else{
            $("#myModal").modal('show');
            $("#myModalLock").modal('hide');
            $("#wo_lock").prop('checked', false);
            $("#wo_lock_unchk").prop('checked', false);
        }
        
        $("#work_order").val(rs.WorkOrder_Id);
        $("#wo_model").val(rs.Model_Id);
        $("#work_center").html($('<option>', {value:0, text: rs.WorkCenter_Id}));

        $("#sub_machine").html('');
        $.getJSON("/get_data_sub_machine_data/"+rs.Model_Id+"/"+rs.WorkCenter_Id, function (data) {
            for (let x = 0; x < data.length; x++) {
              let info = data[x];
              let selected  = '';
              if(info.SubMachine_Id==rs.SubMachine_Id) {
                  selected = 'selected';
              }
              $("#sub_machine").append('<option '+selected+' value='+info.SubMachine_Id+'>'+info.SubMachine_Id+'</option>');
            }
        });

        $("#header_start").val(rs.Header_Start);
        $("#item_id").val(rs.Item_Id);
        $("#header_stop").val(rs.Header_Stop);
        $("#header_qty").val(rs.Header_Real);
        $("#plan_start").val(moment(rs.Plan_Start).add(-7, 'hours').format('DD/MM/YYYY HH:mm:ss'));
        $("#plan_stop").val(moment(rs.Plan_Stop).add(-7, 'hours').format('DD/MM/YYYY HH:mm:ss'));

        $('#header_start').attr('max',rs.Max_Header);
        $('#header_stop').attr('max',rs.Max_Header);

        $('#setup_header').val(rs.SetupHeader_Usage);
        $('#setup_machine').val(rs.SetupMachine_Usage);
        $('#PN_Id').val(rs.PN_Id);
        $('#Week_No').val(rs.Week_No);
        $('#Over_Week').val(rs.Over_Week);
        $('#Over_Promise').val(rs.Over_Promise);
      }
    });    
}

function get(url) {
    return new Promise(function(resolve, reject) {
        var req = new XMLHttpRequest();
        req.open('GET', url);
    
        req.onload = function() {
            if (req.status == 200) {
                resolve(req.response);
            } else {
                reject(Error(req.statusText));
            }
        };
    
        req.onerror = function() {
            reject(Error("Network Error"));
        };
    
        req.send();
    });
}