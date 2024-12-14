const express = require('express');
const path = require('path');
const rti = require('rticonnextdds-connector');
const app = express();
const bodyParser = require('body-parser');
const configFile = path.join(__dirname, 'QSystem.xml');

app.use(bodyParser.json());

const data = []; // Moved outside the function to ensure it is accessible

const connector2 = new rti.Connector('OrderCompletionScreenDomainParticipantLibrary::OrderCompletionScreenPubParticipant', configFile);
const output2 = connector2.getOutput('OrderCompletionScreenPublisher::OrderCompletionScreenWriter');

const run = async () => {
  const connector = new rti.Connector('OrderCompletionScreenDomainParticipantLibrary::OrderCompletionScreenSubParticipant', configFile);
  const input = connector.getInput('OrderCompletionScreenSubscriber::OrderCompletionScreenReader');
  try {
    console.log('Waiting for publications...');
    await input.waitForPublications();

    console.log('Waiting for data...');
    while (true)   {
      await input.wait();
      input.take();
      console.log('Samples received: ' + input.samples.getLength());
      for (const sample of input.samples.validDataIter) {
        const jsonData = sample.getJson();
        console.log('Received data: ' + JSON.stringify(jsonData));
        data.push({
          fromDevice: jsonData.fromDevice,
          toDevice: jsonData.toDevice,
          orderNum: jsonData.orderNum,
        });
      }
    }
  } catch (err) {
    console.log('Error encountered: ' + err);
  }
  connector.close();
};

// Define the API route outside the run function
app.get('/api', (req, res) => {
  res.json(data);
  data.length = 0; // Clear the data array after sending it
});

app.post('/write', async (req, res) => {
  const { fromDevice, toDevice, orderNum } = req.body;
  console.log(req.body);

  try {
    console.log('Writing...');
    output2.instance.setString('fromDevice', fromDevice);
    output2.instance.setString('toDevice', toDevice);
    output2.instance.setNumber('orderNum', orderNum);
    output2.write();

    res.status(200).send('Data written successfully');
  } catch (err) {
    console.error('Error encountered:', err);
    res.status(500).send('Failed to write data: ' + err.message);
  } 
});
process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing connector');
  connector2.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing connector');
  connector2.close();
  process.exit(0);
});

app.listen(5002, async () => {
  console.log("Server started on port 5002");
  await run();
});