import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  const [detailsArray, setDetailsArray] = useState([]);
  const [detail, setDetail] = useState({
    emailName: '',
    sendDate: '',
    region: '',
    productGroup: '',
    assignee: ''
  });
  const [errors, setErrors] = useState({});
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filteredDetailsArray, setFilteredDetailsArray] = useState([]);
  const [isSorted, setIsSorted] = useState(false);
  const [inputMethod, setInputMethod] = useState('manual'); // 'manual' or 'json'
  const [jsonData, setJsonData] = useState('');
  const baseUrl = "https://tg-backend-psvd.onrender.com"

  useEffect(() => {
    fetchDetails();
  }, []);

  const fetchDetails = async () => {
    try {
      const response = await axios.get(`${baseUrl}/api/details`);
      const updatedArrayWithLimits = updateCrossoversAndLimits(response.data);
      setDetailsArray(updatedArrayWithLimits);
      
    } catch (error) {
      console.error('Error fetching details:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDetail(prevDetail => ({
      ...prevDetail,
      [name]: value
    }));
    setErrors(prevErrors => ({
      ...prevErrors,
      [name]: ''
    }));
  };

  const handleJsonChange = (e) => {
    setJsonData(e.target.value);
    setErrors({});
  };

  const parseAndFormatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().split('T')[0]; // Format to YYYY-MM-DD
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options).replace(/ /g, '-');
  };

  const validateFields = () => {
    const newErrors = {};
    if (inputMethod === 'manual') {
      if (!detail.emailName.trim()) newErrors.emailName = 'Email Name is required.';
      if (!detail.sendDate.trim()) newErrors.sendDate = 'Send Date is required.';
      if (!detail.region.trim()) newErrors.region = 'Region is required.';
      if (!detail.productGroup.trim()) newErrors.productGroup = 'Product Group is required.';
      if (!detail.assignee.trim()) newErrors.assignee = 'Assignee is required.';
    } else if (inputMethod === 'json') {
      if (!jsonData.trim()) newErrors.jsonData = 'JSON data is required.';
      try {
        const parsedData = JSON.parse(jsonData);
        if (!Array.isArray(parsedData)) {
          newErrors.jsonData = 'JSON data must be an array of objects.';
        }
        else {
          parsedData.forEach((data, index) => {
            if (!parseAndFormatDate(data["Send date"])) {
              newErrors.jsonData = `Invalid Send Date format in item ${index + 1}.`;
            }
          });
        }
      } catch {
        newErrors.jsonData = 'Invalid JSON format.';
      }
    }
    return newErrors;
  };

  const addDetail = async () => {
    const newErrors = validateFields();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (inputMethod === 'manual') {
      const newDetail = { 
        ...detail, 
        crossovers: [], 
        limitExceeded: false, 
        // id: emailIdCounter,
        regionCounts: { "WW": 0, "APJ": 0, "AMS": 0, "INTL": 0 }
      };
      try {
        const response = await axios.post(`${baseUrl}/api/details`, newDetail);
        const updatedArrayWithLimits = updateCrossoversAndLimits([...detailsArray, response.data]);
        setDetailsArray(updatedArrayWithLimits);
        clearForm();
        
      } catch (error) {
        console.error('Error adding detail:', error);
      }
      
    } else if (inputMethod === 'json') {
      
      try {
        const parsedData = JSON.parse(jsonData);
        if (!Array.isArray(parsedData)) {
          setErrors({ jsonData: 'JSON data must be an array of objects.' });
          return;
        }
        const newDetailsArray = parsedData.map((data, index) => {
          const formattedDate = parseAndFormatDate(data['Send date']);
          if (!formattedDate) {
            setErrors({ jsonData: `Invalid Send Date format in item ${index + 1}.` });
            return null;
          }

          return {
            emailName: data['Email name'] || '',
            sendDate: formattedDate,
            region: data['Region'] || '',
            productGroup: data['Product Group'] || '',
            assignee: data['Assignee'] || '',
            crossovers: [],
            limitExceeded: false,
            regionCounts: { "WW": 0, "APJ": 0, "AMS": 0, "INTL": 0 }
          };
        }).filter(Boolean);

        const addedDetails = [];
        for (const detail of newDetailsArray) {
          const response = await axios.post(`${baseUrl}/api/details`, detail);
          addedDetails.push(response.data);
        }
        
        const updatedArrayWithLimits = updateCrossoversAndLimits([...detailsArray, ...addedDetails]);
        setDetailsArray(updatedArrayWithLimits);
        setJsonData('');
        
      } 
      catch (error){
        console.error('Error adding details from JSON:', error);
        setErrors({ jsonData: 'Invalid JSON format.' });      }
    }
  };

  const clearForm = () => {
    setDetail({
      emailName: '',
      sendDate: '',
      region: '',
      productGroup: '',
      assignee: ''
    });
    setErrors({});
  };

  const clearTable = async () => {
    try {
      const response = await axios.get(`${baseUrl}/api/details`);
      const details = response.data;
      for (const detail of details) {
        await axios.delete(`${baseUrl}/api/details/${detail._id}`).then(response => {
          console.log('Detail deleted:', response.data);
          // Update state to remove the deleted detail from the list
        })
        .catch(error => {
          console.error('Error deleting detail:', error);
          // Handle error, show error message or retry logic
        });
      }
      setDetailsArray([]);
      setFilteredDetailsArray([]);
    } catch (error) {
      console.error('Error clearing table:', error);
    }
  };

  const deleteDetail = async (id) => {
    try {
      await axios.delete(`${baseUrl}/api/details/${id}`).then(response => {
        console.log('Detail deleted:', response.data);
        // Update state to remove the deleted detail from the list
      })
      .catch(error => {
        console.error('Error deleting detail:', error);
        // Handle error, show error message or retry logic
      });
      fetchDetails();
    } catch (error) {
      console.error('Error deleting detail:', error);
    }
  };

  const editDetail = (index) => {
    setDetail(detailsArray[index]);
    // deleteDetail(index);
    deleteDetail(detailsArray[index]._id);
  };

  const updateCrossoversAndLimits = (array, deletedEmail = null) => {
    const previousCountsByProductGroup = {};

    return array.map((email, index) => {
      const crossovers = calculateCrossovers(email, array);
      const regionCounts = calculateRegionCounts(array, index, email.productGroup, deletedEmail, email.sendDate);
      const previousCounts = previousCountsByProductGroup[email.productGroup] || {};
      const limitExceeded = isLimitExceeded(regionCounts, previousCounts);
      previousCountsByProductGroup[email.productGroup] = regionCounts;
      return { ...email, crossovers, limitExceeded, regionCounts };
    });
  };

  const calculateCrossovers = (email, array) => {
    return array.reduce((acc, currentEmail) => {
      if (currentEmail.emailName !== email.emailName && hasCrossover(email, currentEmail)) {
        acc.push(currentEmail.emailName);
      }
      return acc;
    }, []);
  };

  const hasCrossover = (email1, email2) => {
    const sameRegion = email1.region === email2.region;
    const sameProductGroup = email1.productGroup === email2.productGroup;
    const isAdmOrItom = (email1.productGroup === 'ADM' && email2.productGroup === 'ITOM') ||
                        (email1.productGroup === 'ITOM' && email2.productGroup === 'ADM');

    if ((sameRegion && sameProductGroup) || (isAdmOrItom && sameRegion)) {
      const sendDate1 = new Date(email1.sendDate);
      const sendDate2 = new Date(email2.sendDate);
      const diffInDays = Math.abs((sendDate2 - sendDate1) / (1000 * 60 * 60 * 24));
      return diffInDays <= 1;
    } else if (email1.productGroup === 'CROSS' && email2.region === email1.region) {
      const sendDate1 = new Date(email1.sendDate);
      const sendDate2 = new Date(email2.sendDate);
      const diffInDays = Math.abs((sendDate2 - sendDate1) / (1000 * 60 * 60 * 24));
      return diffInDays <= 1;
    } else if (email2.productGroup === 'CROSS' && email1.region === email2.region) {
      const sendDate1 = new Date(email1.sendDate);
      const sendDate2 = new Date(email2.sendDate);
      const diffInDays = Math.abs((sendDate2 - sendDate1) / (1000 * 60 * 60 * 24));
      return diffInDays <= 1;
    } else if ((email1.region === 'WW' || email2.region === 'WW') && (sameProductGroup || isAdmOrItom || email1.productGroup === 'CROSS' || email2.productGroup === 'CROSS')) {
      const sendDate1 = new Date(email1.sendDate);
      const sendDate2 = new Date(email2.sendDate);
      const diffInDays = Math.abs((sendDate2 - sendDate1) / (1000 * 60 * 60 * 24));
      return diffInDays <= 1;
    } else {
      return false;
    }
  };

  const isLimitExceeded = (currentCounts, previousCounts) => {
    for (const region in currentCounts) {
      if (currentCounts[region] > 3 && (previousCounts[region] || 0) < currentCounts[region]) {
        return true;
      }
    }
    return false;
  };

  const calculateRegionCounts = (array, currentIndex, currentProductGroup, deletedEmail, sendDate) => {
    const regionCounts = { "WW": 0, "APJ": 0, "AMS": 0, "INTL": 0 };
    const regionHierarchy = {
      "WW": ["WW", "APJ", "AMS", "INTL"],
      "APJ": ["APJ"],
      "AMS": ["AMS"],
      "INTL": ["INTL"]
    };

    const sendDateObject = new Date(sendDate);
    
    array.forEach((email, index) => {
      if (index <= currentIndex && email.productGroup === currentProductGroup) {
        const emailSendDateObject = new Date(email.sendDate);
        const diffInDays = (sendDateObject - emailSendDateObject) / (1000 * 60 * 60 * 24);
        
        if (Math.abs(diffInDays) <= 6) {
          const targetRegions = regionHierarchy[email.region];
          targetRegions.forEach(region => {
            regionCounts[region]++;
          });
        }
      }
    });

    if (deletedEmail && deletedEmail.productGroup === currentProductGroup) {
      array.forEach((email, index) => {
        if (index > currentIndex) {
          const emailSendDateObject = new Date(email.sendDate);
          const diffInDays = (sendDateObject - emailSendDateObject) / (1000 * 60 * 60 * 24);

          if (Math.abs(diffInDays) <= 6) {
            const targetRegions = regionHierarchy[deletedEmail.region];
            targetRegions.forEach(region => {
              regionCounts[region]--;
            });
          }
        }
      });
    }
console.log(regionCounts, currentIndex);

    return regionCounts;
  };

  const applyFilter = () => {
    const filteredArray = detailsArray.filter(detail => detail.assignee.includes(filterAssignee));
    setFilteredDetailsArray(filteredArray);
  };

  const clearFilter = () => {
    setFilterAssignee('');
    setFilteredDetailsArray([]);
  };

  const sortDetailsBySendDate = () => {
    const sortedArray = [...detailsArray].sort((a, b) => new Date(a.sendDate) - new Date(b.sendDate));
    setDetailsArray(sortedArray);
    setIsSorted(true);
  };

  const displayDetailsArray = filteredDetailsArray.length > 0 ? filteredDetailsArray : detailsArray;

  return (
    <div className="container mt-5">
      <div className="card shadow-sm">
        <div className="card-body">
          <h2 className="mb-4">Email Details</h2>
          <div className="row">
            <div className="col-md-4">
              <div className="form-group">
                <label>Input Method:</label>
                <select
                  value={inputMethod}
                  onChange={(e) => {
                    setInputMethod(e.target.value);
                    setErrors({});
                  }}
                  className="form-control"
                >
                  <option value="manual">Manual</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>
          </div>
          {inputMethod === 'manual' ? (
            <>
              <div className="row">
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Email Name:</label>
                    <input name="emailName" value={detail.emailName} onChange={handleChange} className="form-control" type="text" required/>
                    {errors.emailName && <div className="text-danger">{errors.emailName}</div>}
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Send Date:</label>
                    <input name="sendDate" value={detail.sendDate} onChange={handleChange} className="form-control" type="date" required/>
                    {errors.sendDate && <div className="text-danger">{errors.sendDate}</div>}
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Region:</label>
                    <select name="region" value={detail.region} onChange={handleChange} className="form-control" required>
                      <option value="" disabled>Select one</option>
                      <option value="APJ">APJ</option>
                      <option value="AMS">AMS</option>
                      <option value="INTL">INTL</option>
                      <option value="WW">WW</option>
                    </select>
                    {errors.region && <div className="text-danger">{errors.region}</div>}
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-md-4 offset-md-2">
                  <div className="form-group">
                    <label>Product Group:</label>
                    <select name="productGroup" value={detail.productGroup} onChange={handleChange} className="form-control" required>
                      <option value="" disabled>Select one</option>
                      <option value="AAI">AAI</option>
                      <option value="ADM">ADM</option>
                      <option value="CBS">CBS</option>
                      <option value="ITOM">ITOM</option>
                      <option value="PFO">PFO</option>
                      <option value="CROSS">CROSS</option>
                    </select>
                    {errors.productGroup && <div className="text-danger">{errors.productGroup}</div>}
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Assignee:</label>
                    <input name="assignee" value={detail.assignee} onChange={handleChange} className="form-control" type="text" required />
                    {errors.assignee && <div className="text-danger">{errors.assignee}</div>}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>JSON Data:</label>
              <textarea
                name="jsonData"
                value={jsonData}
                onChange={handleJsonChange}
                className="form-control"
                rows="6"
                required
              ></textarea>
              {errors.jsonData && <div className="text-danger">{errors.jsonData}</div>}
            </div>
          )}
          <div className="text-center">
            <button onClick={addDetail} className="btn btn-primary mr-2">Add</button>
            <button onClick={clearTable} className="btn btn-danger mr-2">Clear</button>
            <button onClick={sortDetailsBySendDate} className="btn btn-info">Sort by Send Date</button>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mt-5">
        <div className="card-body">
          <h2 className="mt-5 mb-3">Touch Governance</h2>
          <div className="mb-3">
            <input
              type="text"
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="form-control d-inline-block w-auto mr-2"
              placeholder="Filter by Assignee"
            />
            <button onClick={applyFilter} className="btn btn-primary mr-2">Filter</button>
            {filterAssignee && (
              <button onClick={clearFilter} className="btn btn-secondary">Clear Filter</button>
            )}
          </div>
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Email Name</th>
                <th>Send Date</th>
                <th>Region</th>
                <th>Product Group</th>
                <th>Assignee</th>
                <th>Crossovers</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayDetailsArray.map((detail, index) => (
                <tr key={index}>
                  <td>{detail.emailName}</td>
                  <td>{formatDate(detail.sendDate)}</td>
                  <td>{detail.region}</td>
                  <td>{detail.productGroup}</td>
                  <td>{detail.assignee}</td>
                  <td>{detail.crossovers.join(', ')}</td>
                  <td>{detail.limitExceeded ? 'Limit Exceeded' : ''}</td>
                  <td>
                    <button onClick={() => editDetail(index)} className="btn btn-secondary btn-sm mr-2">Edit</button>
                    <button onClick={() => deleteDetail(detailsArray[index]._id)} className="btn btn-warning btn-sm">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
