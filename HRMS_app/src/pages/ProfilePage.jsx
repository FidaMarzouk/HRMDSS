import { useState, useEffect } from "react";
import api, { errorMessage, uploadUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatDay, toDateInputValue } from "../lib/dates";
import { 
  User, Mail, Phone, Briefcase, Building, Calendar, 
  DollarSign, Award, Save, Upload, AlertCircle, UserCheck, Lock, Calendar as CalendarIcon
} from "lucide-react";

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    position: "",
    birthdate: "",
    skills: [],
    profilePicture: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [skillInput, setSkillInput] = useState("");
  const [changePassword, setChangePassword] = useState(false);
  const { setUser: setAuthUser } = useAuth();

  // Validation helper functions
  const isNameValid = (name) => /^[\p{L}\s'-]+$/u.test(name);
  const isPhoneValid = (phone) => /^\d+$/.test(phone);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const { data: userData } = await api.get("/api/users/profile");
        setUser(userData);
        {
          setFormData({
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
            email: userData.email || "",
            phone: userData.phone || "",
            position: userData.position || "",
            birthdate: toDateInputValue(userData.birthdate),
            skills: userData.skills || [],
            profilePicture: userData.profilePicture || "",
            currentPassword: "",
            newPassword: "",
            confirmPassword: ""
          });
        }
      } catch (error) {
        setError(errorMessage(error, "An error occurred while fetching your profile"));
        setTimeout(() => setError(""), 5000);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Validate first name and last name (only characters allowed)
    if (name === 'firstName' && value && !isNameValid(value)) {
      setError("First name should only contain letters");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    if (name === 'lastName' && value && !isNameValid(value)) {
      setError("Last name should only contain letters");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    // Validate phone number (only numbers allowed)
    if (name === 'phone' && value && !isPhoneValid(value)) {
      setError("Phone number should only contain numbers");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()]
      });
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter(skill => skill !== skillToRemove)
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const calculateAge = (birthdate) => {
    if (!birthdate) return null;
    
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    // Validate form data before submission
    if (formData.firstName && !isNameValid(formData.firstName)) {
      setError("First name should only contain letters");
      setIsLoading(false);
      return;
    }

    if (formData.lastName && !isNameValid(formData.lastName)) {
      setError("Last name should only contain letters");
      setIsLoading(false);
      return;
    }

    if (formData.phone && !isPhoneValid(formData.phone)) {
      setError("Phone number should only contain numbers");
      setIsLoading(false);
      return;
    }

    // Password validation
    if (changePassword) {
      if (!formData.currentPassword) {
        setError("Current password is required");
        setIsLoading(false);
        return;
      }
      
      if (formData.newPassword !== formData.confirmPassword) {
        setError("New passwords do not match");
        setIsLoading(false);
        return;
      }
    }

    try {
      // Create FormData for file upload
      const data = new FormData();
      
      // Only fields employees may change themselves (email and position are managed by HR)
      const fieldsToAdd = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        skills: formData.skills
      };
      if (formData.birthdate) fieldsToAdd.birthdate = formData.birthdate;
      
      // Add password fields if changing password
      if (changePassword && formData.currentPassword && formData.newPassword) {
        fieldsToAdd.currentPassword = formData.currentPassword;
        fieldsToAdd.password = formData.newPassword;
      }

      // Add fields to FormData
      Object.keys(fieldsToAdd).forEach(key => {
        if (key === "skills") {
          data.append(key, JSON.stringify(fieldsToAdd[key]));
        } else {
          data.append(key, fieldsToAdd[key]);
        }
      });

      // Add profile picture if selected
      if (selectedFile) {
        data.append("profileImage", selectedFile);
      }
  
      const { data: updatedUser } = await api.put("/api/users/profile", data);
      {
        setUser(updatedUser);
        setAuthUser((prev) => (prev ? { ...prev, firstName: updatedUser.firstName, lastName: updatedUser.lastName, profilePicture: updatedUser.profilePicture } : prev));
        setSelectedFile(null);
        setSuccess("Profile updated successfully");
        
        // Reset password fields
        setFormData(prevState => ({
          ...prevState,
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        }));
        setChangePassword(false);
        
        setTimeout(() => setSuccess(""), 5000);
      }
    } catch (error) {
      setError(errorMessage(error, "An error occurred. Please try again."));
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-ground flex items-center justify-center">
        <div className="animate-pulse text-teal">
          <div className="w-16 h-16 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-ground relative overflow-hidden p-6">
      {/* Animated circuit board background */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(15)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute bg-teal/10 h-px"
            style={{
              top: `${Math.random() * 100}%`,
              left: 0,
              right: 0,
              animation: `pulse 3s ${Math.random() * 2}s infinite`
            }}
          />
        ))}
        {[...Array(15)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute bg-teal/10 w-px"
            style={{
              left: `${Math.random() * 100}%`,
              top: 0,
              bottom: 0,
              animation: `pulse 3s ${Math.random() * 2}s infinite`
            }}
          />
        ))}
      </div>

      <div className="max-w-5xl mx-auto relative">
        <div className="absolute inset-0 bg-teal/10 blur-3xl" />
        
        <div className="relative bg-raise backdrop-blur-xl rounded-2xl border border-line overflow-hidden p-8">
          <h3 className="text-2xl font-semibold text-ink mb-6 flex items-center gap-3">
            <UserCheck className="text-teal" />
            User Profile Configuration
          </h3>

          {error && (
            <div className="p-4 mb-6 bg-red/10 border border-red/20 rounded-lg flex items-center gap-3">
              <AlertCircle className="text-red" />
              <p className="text-red">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 mb-6 bg-teal/10 border border-line rounded-lg flex items-center gap-3">
              <Save className="text-teal" />
              <p className="text-teal">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture Section */}
            <div className="flex flex-col md:flex-row items-center gap-8 pb-6 border-b border-line">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-line group-hover:border-teal transition-colors">
                  {(formData.profilePicture || selectedFile) ? (
                    <img 
                      src={selectedFile ? URL.createObjectURL(selectedFile) : (
                        uploadUrl(formData.profilePicture)
                      )} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-sunk flex items-center justify-center">
                      <User className="w-16 h-16 text-ink-3" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-scrim rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <label className="cursor-pointer text-ink text-sm flex flex-col items-center gap-2">
                    <Upload className="w-6 h-6" />
                    <span>Upload</span>
                    <input 
                      type="file" 
                      className="hidden focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 placeholder:text-ink-3" 
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </div>
              
              <div>
                <h5 className="text-lg font-semibold text-ink mb-2">
                  {user?.firstName} {user?.lastName}
                </h5>
                <p className="text-ink-2">
                  {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''}
                </p>
                
                <div className="mt-4 flex flex-wrap gap-2">
                  {user?.departmentId?.name && (
                    <span className="px-3 py-1 bg-teal/10 text-teal rounded-full text-xs">
                      {user.departmentId.name}
                    </span>
                  )}
                  {formData.birthdate && (
                    <span className="px-3 py-1 bg-teal/10 text-teal rounded-full text-xs">
                      Age: {calculateAge(formData.birthdate)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm text-ink-2">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                  <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={`w-full bg-panel border focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 placeholder:text-ink-3 ${
                        formData.firstName && !isNameValid(formData.firstName) 
                          ? 'border-red' 
                          : 'border-line'
                      } rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3`}
                      placeholder="First Name"
                      required
                    />
                    {formData.firstName && !isNameValid(formData.firstName) && (
                      <p className="text-red text-xs mt-1">First name should only contain letters</p>
                    )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-ink-2">Last Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={`w-full bg-panel border focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 placeholder:text-ink-3 ${
                      formData.lastName && !isNameValid(formData.lastName) 
                        ? 'border-red' 
                        : 'border-line'
                    } rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3`}
                    placeholder="Last Name"
                    required
                  />
                  {formData.lastName && !isNameValid(formData.lastName) && (
                    <p className="text-red text-xs mt-1">Last name should only contain letters</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-ink-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    readOnly
                    title="Your login email is managed by HR"
                    className="w-full bg-panel border border-edge rounded-lg pl-10 p-3 text-ink cursor-not-allowed focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 placeholder:text-ink-3"
                    placeholder="Email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-ink-2">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={`w-full bg-panel border focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 placeholder:text-ink-3 ${
                      formData.phone && !isPhoneValid(formData.phone) 
                        ? 'border-red' 
                        : 'border-line'
                    } rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3`}
                    placeholder="Phone Number"
                  />
                  {formData.phone && !isPhoneValid(formData.phone) && (
                    <p className="text-red text-xs mt-1">Phone number should only contain digits</p>
                  )}
                </div>
              </div>
              
              {/* Date of Birth */}
              <div className="space-y-2">
                <label className="text-sm text-ink-2">Date of Birth</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                  <input
                    type="date"
                    name="birthdate"
                    value={formData.birthdate}
                    onChange={handleInputChange}
                    className="w-full bg-panel border border-edge rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3"
                  />
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="pt-4 border-t border-line">
              <h6 className="text-base font-semibold text-ink mb-4">
                Professional Information
              </h6>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="text-sm text-ink-2">Position</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                    <input
                      type="text"
                      name="position"
                      value={formData.position}
                      readOnly
                      title="Your position is managed by HR"
                      className="w-full bg-panel border border-edge rounded-lg pl-10 p-3 text-ink cursor-not-allowed focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 placeholder:text-ink-3"
                      placeholder="Position"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-ink-2">Department</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                    <input
                      type="text"
                      value={user?.departmentId?.name || ""}
                      className="w-full bg-panel border border-edge rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3"
                      placeholder="Department"
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* Non-editable fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="text-sm text-ink-2">Hire Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                    <input
                      type="text"
                      value={user?.hireDate ? formatDay(user.hireDate) : ""}
                      className="w-full bg-panel border border-edge rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3"
                      disabled
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-ink-2">Salary</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                    <input
                      type="text"
                      value={user?.salary ? `${user.salary.toLocaleString()}DT` : ""}
                      className="w-full bg-panel border border-edge rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3"
                      disabled
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-ink-2">Leave Days</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                    <input
                      type="text"
                      value={`${user?.remainingLeaveDays || 0} / ${user?.leaveRequestAllowed || 0}`}
                      className="w-full bg-panel border border-edge rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3"
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* Skills Section */}
              <div className="space-y-4">
                <label className="text-sm text-ink-2">Skills</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {formData.skills.map((skill, index) => (
                    <div 
                      key={index} 
                      className="px-3 py-1 bg-teal/10 text-teal rounded-full text-sm flex items-center gap-2"
                    >
                      <Award className="w-4 h-4" />
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="w-4 h-4 rounded-full bg-teal/15 hover:bg-teal-hi text-ink flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Award className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      className="w-full bg-panel border border-line rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors"
                      placeholder="Add a skill"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-4 py-2 bg-teal text-on-accent rounded-lg hover:bg-teal-hi transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Password Change Section */}
            <div className="pt-4 border-t border-line">
              <div className="flex items-center justify-between mb-4">
                <h6 className="text-base font-semibold text-ink">
                  Password Settings
                </h6>
                <button
                  type="button"
                  onClick={() => setChangePassword(!changePassword)}
                  className="text-teal hover:text-teal transition-colors"
                >
                  {changePassword ? "Cancel" : "Change Password"}
                </button>
              </div>
              
              {changePassword && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="space-y-2">
                    <label className="text-sm text-ink-2">Current Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                      <input
                        type="password"
                        name="currentPassword"
                        value={formData.currentPassword}
                        onChange={handleInputChange}
                        className="w-full bg-panel border border-edge rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3"
                        placeholder="Current Password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-ink-2">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                      <input
                        type="password"
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        className="w-full bg-panel border border-edge rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3"
                        placeholder="New Password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-ink-2">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="w-full bg-panel border border-edge rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors placeholder:text-ink-3"
                        placeholder="Confirm New Password"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t border-line">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-teal text-on-accent py-3 rounded-lg relative overflow-hidden group transition-shadow"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? "Updating..." : "Update Profile"}
                  <Save className="w-5 h-5" />
                </span>
                <div className="absolute inset-0 bg-teal opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
};

export default ProfilePage;