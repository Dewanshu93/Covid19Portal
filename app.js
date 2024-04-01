const express = require('express')
const app = express()
app.use(express.json())
const path = require('path')
let database = null
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const initializeDBandServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}
initializeDBandServer()

const authenticationwithToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', authenticationwithToken, async (request, response) => {
  const {username, password} = request.body
  const selectedUserQuery = `
            SELECT
              *
            FROM
              user
            WHERE
              username='${username}';`
  const dbUser = await database.get(selectedUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticationwithToken, async (request, response) => {
  const getStateSqlQuery = `
            SELECT
              *
            FROM
              state;`
  const allStates = await database.all(getStateSqlQuery)
  response.send(
    allStates.map(singleState => {
      return {
        stateId: singleState.state_id,
        stateName: singleState.state_name,
        population: singleState.population,
      }
    }),
  )
})

app.get(
  '/states/:stateId/',
  authenticationwithToken,
  async (request, response) => {
    const {stateId} = request.params
    const selectedStateQuery = `
              SELECT
                *
              FROM
                state
              WHERE
                state_id = ${stateId};`
    const selectedState = await database.get(selectedStateQuery)
    response.send({
      stateId: selectedState.state_id,
      stateName: selectedState.state_name,
      population: selectedState.population,
    })
  },
)

app.post('/districts/', authenticationwithToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postSqlQuery = `
          INSERT INTO
              district(district_name,state_id,cases,cured,active,deaths)
          VALUES(
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
          );`
  await database.run(postSqlQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticationwithToken,
  async (request, response) => {
    const {districtId} = request.params
    const selectedDistrictQuery = `
            SELECT
              *
            FROM
              district
            WHERE
              district_id = ${districtId};`
    const selectedDistrict = await database.get(selectedDistrictQuery)
    response.send({
      districtId: selectedDistrict.district_id,
      districtName: selectedDistrict.district_name,
      stateId: selectedDistrict.state_id,
      cases: selectedDistrict.cases,
      cured: selectedDistrict.cured,
      active: selectedDistrict.active,
      deaths: selectedDistrict.deaths,
    })
  },
)

app.delete(
  '/districts/:districtId/',
  authenticationwithToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteSqlQuery = `
          DELETE FROM
              district
          WHERE
            district_id=${districtId};`
    await database.run(deleteSqlQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticationwithToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateSqlQuery = `
            UPDATE
              district
            SET
              district_id = ${districtId},
              district_name ='${districtName}',
              state_id= ${stateId},
              cases = ${cases},
              active=${active},
              deaths = ${deaths}
            WHERE
              district_id=${districtId};`
    await database.run(updateSqlQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticationwithToken,
  async (request, response) => {
    const {stateId} = request.params
    const getTotalSqlQuery = `
          SELECT
            SUM(cases), SUM(cured), SUM(active), SUM(deaths)
          FROM
            district
          WHERE
            state_id=${stateId};`
    const totalData = await database.get(getTotalSqlQuery)
    response.send({
      totalCases: totalData['SUM(cases)'],
      totalCured: totalData['SUM(cured)'],
      totalActive: totalData['SUM(active)'],
      totalDeaths: totalData['SUM(deaths)'],
    })
  },
)

module.exports = app
