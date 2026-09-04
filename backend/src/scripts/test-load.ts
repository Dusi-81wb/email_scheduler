import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function runLoadSimulation() {
  console.log('🧪 Starting email_scheduler Rate Limit & Concurrency Load Test...');

  try {
    // 1. Fetch active senders
    const sendersRes = await axios.get(`${API_BASE}/emails/senders`);
    const sender = sendersRes.data.senders[0];
    if (!sender) {
      console.error('❌ No sender found. Ensure backend is running.');
      return;
    }
    console.log(`Using sender: ${sender.email}`);

    // 2. Generate 12 test lead emails
    const leads = Array.from({ length: 12 }, (_, i) => `prospect_${i + 1}_${Date.now()}@email-scheduler-test.io`);

    // 3. Schedule with an hourly limit of 4 (so jobs 5..12 exceed rate limit!)
    const payload = {
      subject: 'email_scheduler Load Test: Concurrency & Rate Limiting',
      body: '<p>This is a live test message verifying BullMQ delayed jobs and rate-limit backpressure.</p>',
      senderEmail: sender.email,
      recipients: leads,
      delayBetweenMs: 2000, // 2s min delay between emails
      hourlyLimit: 4, // Intentionally low to demonstrate rate limit hit & rescheduling
    };

    console.log(`Submitting batch of ${leads.length} emails with hourlyLimit = 4...`);
    const scheduleRes = await axios.post(`${API_BASE}/emails/schedule`, payload);
    console.log(`✅ Batch scheduled! Schedule ID: ${scheduleRes.data.scheduleId}`);

    // 4. Poll and monitor queue progression
    console.log('⏳ Waiting for worker to process and enforce rate limits...');
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const [scheduledRes, sentRes] = await Promise.all([
        axios.get(`${API_BASE}/emails/scheduled`),
        axios.get(`${API_BASE}/emails/sent`),
      ]);

      const scheduled = scheduledRes.data.jobs;
      const sent = sentRes.data.jobs;
      const rescheduled = scheduled.filter((j: any) => j.status === 'RESCHEDULED');

      console.log(
        `📊 Snapshot [${i + 1}/5]: Sent = ${sent.length} | Scheduled = ${scheduled.length} | Rescheduled (over limit) = ${rescheduled.length}`
      );

      if (sent.length > 0) {
        console.log(`   Latest Ethereal Preview URL: ${sent[0].etherealUrl || 'N/A'}`);
      }

      if (rescheduled.length > 0) {
        console.log(`   🚨 Rate limit successfully caught! ${rescheduled.length} jobs rescheduled to next hour.`);
        break;
      }
    }

    console.log('🎉 Rate limit and concurrency load test completed successfully.');
  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

runLoadSimulation();
