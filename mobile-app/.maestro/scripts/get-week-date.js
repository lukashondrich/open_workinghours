// Calculate current week's Monday date key for dynamic testID targeting
// Used in calendar flows where we need to interact with specific days

const now = new Date();
const day = now.getDay(); // 0=Sun, 1=Mon, ...6=Sat
const diff = day === 0 ? -6 : 1 - day; // Shift to Monday
const monday = new Date(now);
monday.setDate(now.getDate() + diff);

// Format as YYYY-MM-DD
const dateKey = monday.toISOString().slice(0, 10);

// Output for Maestro
output.weekStart = dateKey;
output.today = now.toISOString().slice(0, 10);

// Also output each day of the week
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
for (let i = 0; i < 7; i++) {
  const d = new Date(monday);
  d.setDate(monday.getDate() + i);
  output[days[i]] = d.toISOString().slice(0, 10);
}
