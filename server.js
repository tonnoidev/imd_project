const { config, port } = require('./config');

const bodyParser = require('body-parser');
const path = require('path');
const express = require("express");
const router = express.Router();
const app = express();
const sql = require("mssql");

const _sql =
  "select b.Team_Id,b.WorkCenter_Id,b.Lane_Id,a.SubMachine_Id " +
  ",a.WorkOrder_Id,c.Item_Id,c.Model_Id " +
  ",a.Plan_Start,a.Plan_Start_Hour " +
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
  debugger
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
