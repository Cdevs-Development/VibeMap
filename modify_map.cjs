const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'FamilyMap.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add API import
content = content.replace(
  "import { GPSSmoother } from '../services/gpsSmoothing'",
  "import { GPSSmoother } from '../services/gpsSmoothing'\nimport API from '../services/api'"
);

// 2. Remove mockFamily
content = content.replace(/\/\/ Mock family members.*?const mockFamily = \[\s*(?:\{[^}]*\},\s*)*\]\n/s, '');

// 3. Add state and useEffect
const stateHook = `  const [watchedUsers, setWatchedUsers] = useState([])

  useEffect(() => {
    const fetchWatchedUsers = async () => {
      try {
        const response = await API.get('/users/my-watched')
        setWatchedUsers(response.data)
      } catch (err) {
        console.error('Failed to fetch watched users:', err)
      }
    }

    fetchWatchedUsers()
    const intervalId = setInterval(fetchWatchedUsers, 15000)

    return () => clearInterval(intervalId)
  }, [])\n`;

content = content.replace(
  '  const [selectedPerson, setSelectedPerson] = useState(null)',
  stateHook + '  const [selectedPerson, setSelectedPerson] = useState(null)'
);

// 4. Update helper functions
content = content.replace(/person\.sosActive/g, 'person.sos_active');
content = content.replace(/person\.isSharing/g, 'person.is_sharing_location');
content = content.replace(/person\.avatar/g, "'👤'");
content = content.replace(/`Active · \$\{person\.lastSeen\}`/g, "'Active'");

// 5. Replace mockFamily references
content = content.replace(/mockFamily\.find\(p => p\.sosActive\)/g, 'watchedUsers.find(p => p.sos_active)');
content = content.replace(/mockFamily\.filter\(p => p\.isSharing\)/g, 'watchedUsers.filter(p => p.is_sharing_location)');
content = content.replace(/mockFamily\.length/g, 'watchedUsers.length');
content = content.replace(/mockFamily\.some\(p => p\.sosActive\)/g, 'watchedUsers.some(p => p.sos_active)');

// 6. Replace person properties in JSX
content = content.replace(/person\.longitude/g, 'person.last_lng');
content = content.replace(/person\.latitude/g, 'person.last_lat');
content = content.replace(/person\.name/g, 'person.full_name');

content = content.replace(/activeSos\.longitude/g, 'activeSos.last_lng');
content = content.replace(/activeSos\.latitude/g, 'activeSos.last_lat');
content = content.replace(/firstSos\.longitude/g, 'firstSos.last_lng');
content = content.replace(/firstSos\.latitude/g, 'firstSos.last_lat');
content = content.replace(/selectedPerson\.longitude/g, 'selectedPerson.last_lng');
content = content.replace(/selectedPerson\.latitude/g, 'selectedPerson.last_lat');
content = content.replace(/selectedPerson\.name/g, 'selectedPerson.full_name');
content = content.replace(/selectedPerson\.isSharing/g, 'selectedPerson.is_sharing_location');
content = content.replace(/selectedPerson\.sosActive/g, 'selectedPerson.sos_active');

// 7. Update map rendering to conditionally render
const parts = content.split('{mockFamily.map(person => (');

if (parts.length === 3) {
  const mapReplace = `{watchedUsers.map(person => {
            if (!person.is_sharing_location || person.last_lat === null || person.last_lng === null) return null;
            return (`;
            
  // Fix the closing bracket for the first map block
  let p1 = parts[1].replace(/<\/Marker>\s*\)\)}/, '</Marker>\n            );\n          })}');
  
  content = parts[0] + mapReplace + p1 + '{watchedUsers.map(person => (' + parts[2];
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully updated FamilyMap.jsx');
