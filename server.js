const { config, port } = require('./config');

const bodyParser = require('body-parser');
const path = require('path');
const express = require("express");
const router = express.Router();
const app = express();
const sql = require("mssql");

const _sql =
  "select " +
  "(case when (datediff(day, a.Plan_Start, a.Plan_Stop) + 1) = 1 " +
  "then (datediff(day, a.Plan_Start, a.Plan_Stop) + 1 + a.Plan_Stop_Hour - a.Plan_Start_Hour) " +
  "else 0 end) slot, datediff(day, Plan_Start, Plan_Stop)+1 diff_date, " +
  "((SetupMachine_Usage/60)+ " +
  "(case when SetupMachine_Usage>0 then 1 else 0 end)+ " +
  "(case when SetupHeader_Usage>0 then 1 else 0 end)+ " +
  "(case when (Over_Week=0 or Over_Promise=0 or Plan_Lock='L') then 1 else 0 end)) SM_U, " +
  "(SELECT (CASE WHEN t2.h > 0 THEN 0 ELSE t2.c END) AS Shift " +
  "FROM (SELECT 480 * (CASE WHEN t1.c > 0 THEN 2 ELSE 1 END) AS c, " +
  "(SELECT COUNT(Holiday_date) AS Expr1 " +
  "FROM Holiday_TB AS h WHERE (Holiday_date = a.SetupMachine)) AS h " +
  "FROM (SELECT COUNT(Shift_Duty_Id) AS c " +
  "FROM Shift_Duty_TB AS sd WHERE (Shift_Duty_Date = a.SetupMachine) " +
  "AND (SubMachine_Id =a.SubMachine_Id) ) AS t1) AS t2 ) as rowSize," +
  "(select count(*) from WorkOrder_TB where WorkOrder_Id=a.WorkOrder_Id and  Order_Factor='SS' AND SaleOrder_Id is not null) ATP," +
  "b.Team_Id,b.WorkCenter_Id,b.Lane_Id,a.SubMachine_Id,PN_Id " +
  ",a.WorkOrder_Id,c.Item_Id,c.Model_Id ,a.Plan_Start,a.Plan_Start_Hour " +
  ",a.Plan_Stop,a.Plan_Stop_Hour,a.Week_No,a.SetupMachine " +
  ",a. SetupMachine_Usage,a.SetupHeader_Usage,a.Production_Usage " +
  ",b.Max_Header,a.HeaderUsage,a.Header_Real,a.Header_Virtual,a.Header_Start,a.Header_Stop " +
  ",a.Over_Week,a.Over_Promise,a.Plan_Type,a.Plan_Lock " +
  "from PlanningDetailTemp_TB a " +
  "inner join SubMachine_TB b on a.SubMachine_Id=b.SubMachine_Id " +
  "inner join WorkOrderScoring_TB c on left(a.WorkOrder_Id,8)=c.WorkOrder_Id " + 
  "where 1=1 and Plan_Start >= CONCAT(convert(date, getdate(), 103), ' 00:00:00') ";

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});

router.get("/api/list/holidays", (req, res) => {
  new sql.ConnectionPool(config).connect().then(pool=>{
    return pool.request().query("select Holiday_date from Holiday_TB where Holiday_date >= convert(date, getdate(), 103)")
    }).then(result => {
      res.json(result.recordset);
      sql.close();
    }).catch(err => {
      res.send({ message: err})
      sql.close();
    });
});

router.get("/get_data_sub_machine_data/:model_id/:work_center_id", (req, res) => {
  let model_id = req.params.model_id;
  let work_center_id = req.params.work_center_id;
  new sql.ConnectionPool(config).connect().then(pool=>{
    let query  = " SELECT  sm.SubMachine_Id, sm.SubMachine_Name FROM VirtualHead_TB vh ";
        query += " JOIN SubMachine_TB sm ON sm.SubMachine_Id = vh.SubMachine_Id ";
        query += " JOIN WorkCenter_TB wc ON wc.WorkCenter_Id = sm.WorkCenter_Id  ";
        query += " WHERE vh.Model_Id = '"+model_id+"' AND sm.WorkCenter_Id = '"+work_center_id+"' ";
        query += " GROUP BY sm.SubMachine_Id, sm.SubMachine_Name ";
    return pool.request().query(query)
    }).then(result => {
      res.json(result.recordset);
      sql.close();
    }).catch(err => {
      res.send({ message: err})
      sql.close();
    });
});

router.post("/api/plan/:wc_id/:team_id", (req, res) => {
  let query = _sql;

  let wc_id = req.params.wc_id;
  let team_id = req.params.team_id;

  if(wc_id !== 'x'){
    query += " and WorkCenter_Id='" + wc_id + "' ";
  }
  if(team_id !== 'x'){
    query += " and Team_Id='" + team_id + "' ";
  }

  new sql.ConnectionPool(config).connect().then(pool=>{
    query += ' order by Team_Id, WorkCenter_Id, Lane_Id, SubMachine_Id, Plan_Start';
    return pool.request().query(query);
    }).then(result => {
      res.json(result.recordset);
      sql.close();
    }).catch(err => {
      res.send({ message: err})
      sql.close();
    });
});

router.get("/api/plan_enddate/:wc_id/:team_id", (req, res) => {
  let query = 'select top 1 a.Plan_Stop from PlanningDetailTemp_TB a ';
  query += 'inner join SubMachine_TB b on a.SubMachine_Id=b.SubMachine_Id ';
  query += 'inner join WorkOrderScoring_TB c on left(a.WorkOrder_Id,8)=c.WorkOrder_Id ';
  query += 'where 1=1 ';

  let wc_id = req.params.wc_id;
  let team_id = req.params.team_id;

  if(wc_id !== 'x'){
    query += " and WorkCenter_Id='" + wc_id + "' ";
  }
  if(team_id !== 'x'){
    query += " and Team_Id='" + team_id + "' ";
  }
  query += ' order by Plan_Start desc ';
  
  new sql.ConnectionPool(config).connect().then(pool=>{    
    return pool.request().query(query);
    }).then(result => {
      res.json(result.recordset);
      sql.close();
    }).catch(err => {
      res.send({ message: err})
      sql.close();
    });
});

router.post("/api/machine/:wc_id/:team_id", (req, res) => {
  let wc_id = req.params.wc_id; 
  let team_id = req.params.team_id;

  new sql.ConnectionPool(config).connect().then(pool=>{
    let query = "select b.*, Header_Real, Header_Virtual from SubMachine_TB b left join PlanningDetailTemp_TB a on a.SubMachine_Id=b.SubMachine_Id where 1=1 ";
    if(wc_id!=='x'){
      query += "and WorkCenter_Id='"+wc_id+"' ";
    }
    if(team_id!=='x'){
      query += "and Team_Id='"+team_id+"' ";
    }
    
    query += " order by Team_Id, WorkCenter_Id, Lane_Id, b.SubMachine_Id";
    return pool.request().query(query);
    }).then(result => {
      res.json(result.recordset);
      sql.close();
    }).catch(err => {
      res.send({ message: err});
      sql.close();
    });
});

router.get("/api/list/opts/:wc_id/:team_id", (req, res) => {
  let query = '';
  let wc_id = req.params.wc_id; 
  let team_id = req.params.team_id;
  if(wc_id !=='x'){
    query = 'select WorkCenter_Id from WorkCenter_TB group by WorkCenter_Id order by WorkCenter_Id';
  }else if(team_id !== 'x'){
    query = 'select Team_Id from Team_TB order by Team_Id';
  }

  new sql.ConnectionPool(config).connect().then(pool=>{
    return pool.request().query(query)
    }).then(result => {
      res.json(result.recordset);
      sql.close();
    }).catch(err => {
      res.send({ message: err})
      sql.close();
    });
});

router.get("/find_wo/:wc_id", (req, res) => {
  let wc_id = req.params.wc_id;
  new sql.ConnectionPool(config).connect().then(pool=>{
    let query = _sql + " and a.WorkOrder_Id='"+wc_id+"'";
    return pool.request().query(query);
    }).then(result => {
      res.json(result.recordset);
      sql.close();
    }).catch(err => {
      res.send({ message: err});
      sql.close();
    });
});

router.post("/upd/wo/:wo_id/:status", (req, res)=> {
  let wo_id = req.params.wo_id;
  let status = req.params.status;
  if(status==='N') {
    status = 'NULL';
  } else {
    status = "'" + status + "'";
  }
  new sql.ConnectionPool(config).connect().then(pool=>{
    return pool.request().query("update PlanningDetailTemp_TB set Plan_Lock="+status+" where WorkOrder_Id='"+wo_id+"'");
  }).then(result => {
    res.json('success');
    sql.close();
  }).catch(err => {
    res.send({ message: err})
    sql.close();
  });
});

router.post("/save_manual_suggest_plan", (req, res)=> {
  let info = req.body;

  let query1 = "UPDATE PlanningTemp_TB SET ";
    query1 += "Plan_Start='"+(info.Plan_Start.substr(0, 10))+"',";
    query1 += "Plan_Stop='"+(info.Plan_Stop.substr(0, 10))+"',";
    query1 += "Plan_Status='W',";
    query1 += "Create_Date=GETDATE(),";
    query1 += "Update_Date=GETDATE() ";
    query1 += "WHERE PN_Id = "+info.PN_Id;

  let query2 = "UPDATE PlanningDetailTemp_TB SET  ";
    query2 += "WorkOrder_Id='"+info.WorkOrder_Id+"', ";
    query2 += "SubMachine_Id='"+info.SubMachine_Id+"', ";
    query2 += "Plan_Start='"+info.Plan_Start+"', ";
    query2 += "Plan_Start_Hour='"+info.Plan_Start_Hour+"', ";
    query2 += "Plan_Stop='"+info.Plan_Stop+"', ";
    query2 += "Plan_Stop_Hour='"+info.Plan_Stop_Hour+"', ";
    query2 += "Week_No='"+info.Week_No+"', ";
    query2 += "SetupMachine='"+info.SetupMachine+"', ";
    query2 += "SetupMachine_Usage='"+info.SetupMachine_Usage+"', ";
    query2 += "SetupHeader_Usage='"+info.SetupHeader_Usage+"', ";
    query2 += "Production_Usage='"+info.Production_Usage+"', ";
    query2 += "HeaderUsage='"+info.HeaderUsage+"', ";
    query2 += "Header_Real='"+info.Header_Real+"', ";
    query2 += "Header_Virtual='"+info.Header_Virtual+"', ";
    query2 += "Header_Start='"+info.Header_Start+"', ";
    query2 += "Header_Stop='"+info.Header_Stop+"', ";
    query2 += "Over_Week='"+info.Over_Week+"', ";
    query2 += "Over_Promise='"+info.Over_Promise+"', ";
    query2 += "Plan_Type='M', ";
    query2 += "Plan_Lock='L', ";
    query2 += "Create_Date=GETDATE(), ";
    query2 += "Update_Date=GETDATE()  ";
    query2 += "WHERE PN_Id = "+info.PN_Id;

    new sql.ConnectionPool(config).connect().then(pool=>{
      pool.request().query(query1, function(err, recordset){
        if(err){
          console.error(err);
          res.status(500).send(err.message);
          return;
        }

        pool.request().query(query2, function(err, recordset){
          if(err){
            console.error(err);
            res.status(500).send(err.message);
            return;
          }

        });
      });
    }).then(result => {
      res.json('success');
      sql.close();
    }).catch(err => {
      res.send({ message: err})
      sql.close();
    });
});

router.post("/api/getDateWorkMin", (req, res) => {
  let mList = req.body.data;
  let query = 'SELECT SubMachine_Id, Shift_Duty_Date ';
  query += 'FROM Shift_Duty_TB ';
  query += 'WHERE Shift_Duty_Date NOT IN (select Holiday_date from Holiday_TB)  ';
  query += 'AND SubMachine_Id in('+mList+') ';
  new sql.ConnectionPool(config).connect().then(pool=>{
    return pool.request().query(query);
    }).then(result => {
      res.json(result.recordset);
      sql.close();
    }).catch(err => {
      res.send({ message: err})
      sql.close();
    });
});

router.get("/get_promise_date/:wo_id", (req, res) => {
  let wo_id = req.params.wo_id;
  new sql.ConnectionPool(config).connect().then(pool=>{
    let query = "SELECT Promise_Date FROM WorkOrder_TB WHERE WorkOrder_Id=SUBSTRING('"+wo_id+"',1,8)";
    return pool.request().query(query);
    }).then(result => {
      res.json(result.recordset);
      sql.close();
    }).catch(err => {
      res.send({ message: err});
      sql.close();
    });
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.all('*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/node_modules'));
app.use("/", router);

app.listen(port, () => {
  console.log("Server is running... port = " + port);
});
