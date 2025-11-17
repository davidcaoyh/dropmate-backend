import { logStatusChange, getShipmentEvents } from './src/models/shipmentEventsModel.js';

async function test() {
  try {
    console.log('Testing event logging...');
    
    // Log a test event
    const event = await logStatusChange(20, 'assigned', 'in_transit', null, {
      test: true
    });
    
    console.log('Event created:', event);
    
    // Get events
    const events = await getShipmentEvents(20);
    console.log('All events:', events);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

test();
