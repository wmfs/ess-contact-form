/* eslint-env mocha */
const tymly = require('@wmfs/tymly')
const path = require('path')
const expect = require('chai').expect
const process = require('process')

describe('data import', function () {
  this.timeout(process.env.TIMEOUT || 5000)

  const STATE_MACHINE_NAME = 'wmfs_casualtyReport_1_0'

  let statebox, executionName, tymlyService

  before(function () {
    if (process.env.PG_CONNECTION_STRING && !/^postgres:\/\/[^:]+:[^@]+@(?:localhost|127\.0\.0\.1).*$/.test(process.env.PG_CONNECTION_STRING)) {
      console.log(`Skipping tests due to unsafe PG_CONNECTION_STRING value (${process.env.PG_CONNECTION_STRING})`)
      this.skip()
    }
  })

  it('startup tymly', function (done) {
    tymly.boot(
      {
        pluginPaths: [
          require.resolve('@wmfs/tymly-pg-plugin'),
          require.resolve('@wmfs/tymly-users-plugin'),
          require.resolve('@wmfs/tymly-solr-plugin'),
          require.resolve('@wmfs/tymly-test-helpers/plugins/allow-everything-rbac-plugin')
        ],
        blueprintPaths: [
          path.resolve(__dirname, './../'),
          require.resolve('@wmfs/gazetteer-blueprint')
        ],
        config: {}
      },
      function (err, tymlyServices) {
        expect(err).to.eql(null)
        statebox = tymlyServices.statebox
        tymlyService = tymlyServices.tymly
        done()
      }
    )
  })

  it('start a casualty report', function (done) {
    statebox.startExecution(
      {}, // input
      STATE_MACHINE_NAME, // state machine name
      {
        sendResponse: 'AFTER_RESOURCE_CALLBACK.TYPE:awaitingHumanInput'
      }, // options
      function (err, executionDescription) {
        expect(err).to.eql(null)
        executionName = executionDescription.executionName
        expect(executionDescription.status).to.eql('RUNNING')
        expect(executionDescription.currentStateName).to.eql('AwaitingHumanInput')
        done()
      }
    )
  })

  it('send form data', function (done) {
    statebox.sendTaskSuccess(
      executionName,
      {
        formData: {
        }
      }, // output
      {}, // executionOptions
      function (err) {
        expect(err).to.eql(null)
        done()
      }
    )
  })

  it('wait for execution to complete', async () => {
    await statebox.waitUntilStoppedRunning(executionName)
  })

  it('shutdown Tymly', async () => {
    await tymlyService.shutdown()
  })
})
