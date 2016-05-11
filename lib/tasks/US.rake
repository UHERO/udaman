#US DATA


###*******************************************************************
###NOTES BOX

#be sure to use lower case for "increment" command
#when there are non-number things in the CSV, move the location up to avoid them
#some of the month download files seem to be downloading inconsistent time periods
#some of the GPP series are pulling blanks, and this is unexplained

###*******************************************************************


task :us_upd_q => :environment do
  t = Time.now
	us_q = {
	
	"GDP_C@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:2", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_C_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:2", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_CD@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:4", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_CD_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:4", :col => "increment:195:1", :frequency => "Q" }|,
	"GDP_CN@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:5", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_CN_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:5", :col => "increment:195:1", :frequency => "Q" }|,
	"GDP_CS@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:6", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_CS_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:6", :col => "increment:195:1", :frequency => "Q" }|,
	"GDP_EX@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:15", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_EX_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:15", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_G@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:21", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_G_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:21", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_I@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:7", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_I_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:7", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_IFX@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:8", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_IFX_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:8", :col => "increment:195:1", :frequency => "Q" }|,
	"GDP_IIV@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:13", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_IIV_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:13", :col => "increment:195:1", :frequency => "Q" }|,
	"GDP_IM@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:18", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_IM_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:18", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_INR@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:9", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_INR_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:9", :col => "increment:195:1", :frequency => "Q" }|,
	"GDP_IRS@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:12", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_IRS_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:12", :col => "increment:195:1", :frequency => "Q" }|,
	"GDP_NX@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:14", :col => "increment:3:1", :frequency => "Q" }|,
	"GDP_NX_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:14", :col => "increment:195:1", :frequency => "Q" }|,
	"GDPDEF@US.Q" => %Q|Series.load_from_download  "13Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:1", :col => "increment:3:1", :frequency => "Q" }|,
	"INFGDPDEF@US.Q" => %Q|"GDPDEF@US.Q".ts.annualized_percentage_change|,
	"GDPPC@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:1", :col => "increment:3:1", :frequency => "Q" }|,
	"GDPPC_R@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:10", :col => "increment:3:1", :frequency => "Q" }|,
	"GNP@US.Q" => %Q|Series.load_from_download  "43Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:4", :col => "increment:3:1", :frequency => "Q" }|,
	"GNP_R@US.Q" => %Q|Series.load_from_download  "44Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:4", :col => "increment:3:1", :frequency => "Q" }|,
	"GNPPC@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:2", :col => "increment:3:1", :frequency => "Q" }|,
	"GNPPC_R@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:11", :col => "increment:3:1", :frequency => "Q" }|,
	"N@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:18", :col => "increment:3:1", :frequency => "Q" }|,
	"Y@US.Q" => %Q|Series.load_from_download  "58Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:1", :col => "increment:3:1", :frequency => "Q" }|,
	"YCE@US.Q" => %Q|Series.load_from_download  "58Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:29", :col => "increment:3:1", :frequency => "Q" }|,
	"YCE_R@US.Q" => %Q|Series.load_from_download  "66Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:1", :col => "increment:3:1", :frequency => "Q" }|,
	"YDPI@US.Q" => %Q|Series.load_from_download  "58Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:27", :col => "increment:3:1", :frequency => "Q" }|,
	"YDPI_R@US.Q" => %Q|Series.load_from_download  "58Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:37", :col => "increment:3:1", :frequency => "Q" }|,
	"YPC@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:3", :col => "increment:3:1", :frequency => "Q" }|,
	"YPCCE@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:5", :col => "increment:3:1", :frequency => "Q" }|,
	"YPCCE_R@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:13", :col => "increment:3:1", :frequency => "Q" }|,
	"YPCDPI@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:4", :col => "increment:3:1", :frequency => "Q" }|,
	"YPCDPI_R@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => "header:col:1:12", :col => "increment:3:1", :frequency => "Q" }|,
	"CAPUMN@US.Q" => %Q|Series.load_from_download  "US_CAPUMN_Q@research.stlouisfed.org", { :file_type => "txt", :frequency => "Q" }|,
	
		#"GDPDEF@US.Q" => %Q|Series.load_from_download  "13Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 7, :col => "increment:3:1", :frequency => "Q" }|, 
		#"YPC@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 11, :col => "increment:3:1", :frequency => "Q" }|, 
		#"YPCDPI@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 12, :col => "increment:3:1", :frequency => "Q" }|, 
		#"YPCCE@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 13, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDPPC@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 9, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GNPPC@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 10, :col => "increment:3:1", :frequency => "Q" }|, 
		#"YPCDPI_R@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 20, :col => "increment:3:1", :frequency => "Q" }|, 
		#"YPCCE_R@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 21, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDPPC_R@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 18, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GNPPC_R@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 19, :col => "increment:3:1", :frequency => "Q" }|, 
		#"N@US.Q" => %Q|Series.load_from_download  "264Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 26, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GNP@US.Q" => %Q|Series.load_from_download  "43Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 10, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GNP_R@US.Q" => %Q|Series.load_from_download  "44Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 11, :col => "increment:3:1", :frequency => "Q" }|, 
		#"Y@US.Q" => %Q|Series.load_from_download  "58Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 7, :col => "increment:3:1", :frequency => "Q" }|, 
		#"YDPI@US.Q" => %Q|Series.load_from_download  "58Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 33, :col => "increment:3:1", :frequency => "Q" }|, 
		#"YCE@US.Q" => %Q|Series.load_from_download  "58Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 35, :col => "increment:3:1", :frequency => "Q" }|, 
		#"YDPI_R@US.Q" => %Q|Series.load_from_download  "58Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 43, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_C@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 8, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_CD@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 10, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_CN@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 11, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_CS@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 12, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_I@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 13, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_IFX@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 14, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_INR@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 15, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_IRS@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 18, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_IIV@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 19, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_NX@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 20, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_EX@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 21, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_IM@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 24, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_G@US.Q" => %Q|Series.load_from_download  "5Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 27, :col => "increment:3:1", :frequency => "Q" }|, 
		#"YCE_R@US.Q" => %Q|Series.load_from_download  "66Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 8, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_C_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 9, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_CD_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 11, :col => "increment:195:1", :frequency => "Q" }|, 
		#"GDP_CN_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 12, :col => "increment:195:1", :frequency => "Q" }|, 
		#"GDP_CS_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 13, :col => "increment:195:1", :frequency => "Q" }|, 
		#"GDP_I_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 14, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_IFX_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 15, :col => "increment:195:1", :frequency => "Q" }|, 
		#"GDP_INR_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 16, :col => "increment:195:1", :frequency => "Q" }|, 
		#"GDP_IRS_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 19, :col => "increment:195:1", :frequency => "Q" }|, 
		#"GDP_IIV_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 20, :col => "increment:195:1", :frequency => "Q" }|, 
		#"GDP_NX_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 21, :col => "increment:195:1", :frequency => "Q" }|, 
		#"GDP_EX_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 22, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_IM_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 25, :col => "increment:3:1", :frequency => "Q" }|, 
		#"GDP_G_R@US.Q" => %Q|Series.load_from_download  "6Q@bea.gov", { :file_type => "csv", :start_date => "1947-01-01", :row => 28, :col => "increment:3:1", :frequency => "Q" }|, 
		"GDP@US.Q" => %Q|Series.load_from_download  "us_gdp@bea.gov", { :file_type => "xls", :start_date => "1947-01-01", :sheet => "sheet_num:1", :row => "increment:9:1", :col => 6, :frequency => "Q" }|, 
		"GDP_R@US.Q" => %Q|Series.load_from_download  "us_gdp@bea.gov", { :file_type => "xls", :start_date => "1947-01-01", :sheet => "sheet_num:1", :row => "increment:9:1", :col => 7, :frequency => "Q" }|,
		"YP@CA.Q" => %Q|Series.load_from_download "CA_YP@bea.gov", {:file_type => "csv", :start_date => "1948-01-01", :row => 6, :col => "increment:3:1", :frequency => "Q"}|
	}
	
  us_q_special = {
  
    "YP@CA.Q" => %Q|Series.load_from_download "CA_YP@bea.gov", {:file_type => "csv", :start_date => "1948-01-01", :row => 6, :col => "increment:3:1", :frequency => "Q"}|
  
  }

	us_q_nowrite = {

	"YCE_R@US.Q" => %Q|"YCE_R@US.M".ts.aggregate(:quarter, :average)|,
	"YPCDPI@US.Q" => %Q|"YPCDPI@US.M".ts.aggregate(:quarter, :average)|,
	"YPCDPI_R@US.Q" => %Q|"YPCDPI_R@US.M".ts.aggregate(:quarter, :average)|,
	"YDPI@US.Q" => %Q|"YDPI@US.M".ts.aggregate(:quarter, :average)|,
	"YDPI_R@US.Q" => %Q|"YDPI_R@US.M".ts.aggregate(:quarter, :average)|,
	"YCE@US.Q" => %Q|"YCE@US.M".ts.aggregate(:quarter, :average)|,
	"Y@US.Q" => %Q|"Y@US.M".ts.aggregate(:quarter, :average)|,


	}

		
	p = Packager.new
	p.add_definitions us_q
	p.write_definitions_to "#{ENV['DATA_PATH']}/us/update/us_upd_q_NEW.xls"
	
  p = Packager.new
  p.add_definitions us_q_special
  p.write_definitions_to "#{ENV['DATA_PATH']}/us/update/us_upd_q2_NEW.xls"
	
	p = Packager.new
	p.add_definitions us_q_nowrite
	p.write_definitions_to "#{ENV['DATA_PATH']}/rawdata/trash/us_upd_q_ID.xls"
	CSV.open("public/rake_time.csv", "a") {|csv| csv << ["us_upd_q", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :us_upd_a => :environment do
  t = Time.now
	us_a = {
		"GDP_C@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:2", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_C_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:2", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_CD@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:4", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_CD_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:4", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_CN@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:5", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_CN_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:5", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_CS@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:6", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_CS_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:6", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_EX@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:15", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_EX_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:15", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_G@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:21", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_G_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:21", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_I@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:7", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_I_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:7", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_IFX@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:8", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_IFX_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:8", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_IIV@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:13", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_IIV_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:13", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_IM@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:18", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_IM_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:18", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_INR@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:9", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_INR_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:9", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_IRS@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:12", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_IRS_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:12", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_NX@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:14", :col => "increment:3:1", :frequency => "A" }|,
		"GDP_NX_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:14", :col => "increment:3:1", :frequency => "A" }|,
		"GDPDEF@US.A" => %Q|Series.load_from_download  "13A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:1", :col => "increment:3:1", :frequency => "A" }|,
		"GDPPC@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:1", :col => "increment:3:1", :frequency => "A" }|,
		"GDPPC_R@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:10", :col => "increment:3:1", :frequency => "A" }|,
		"GNP@US.A" => %Q|Series.load_from_download  "43A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:4", :col => "increment:3:1", :frequency => "A" }|,
		"GNP_R@US.A" => %Q|Series.load_from_download  "44A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:4", :col => "increment:3:1", :frequency => "A" }|,
		"GNPPC@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:2", :col => "increment:3:1", :frequency => "A" }|,
		"GNPPC_R@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:11", :col => "increment:3:1", :frequency => "A" }|,
		"Y@US.A" => %Q|Series.load_from_download  "58A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:1", :col => "increment:3:1", :frequency => "A" }|,
		"YCE@US.A" => %Q|Series.load_from_download  "58A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:29", :col => "increment:3:1", :frequency => "A" }|,
		"YCE_R@US.A" => %Q|Series.load_from_download  "66A@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:1", :col => "increment:3:1", :frequency => "A" }|,
		"YDPI@US.A" => %Q|Series.load_from_download  "58A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:27", :col => "increment:3:1", :frequency => "A" }|,
		"YDPI_R@US.A" => %Q|Series.load_from_download  "58A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:37", :col => "increment:3:1", :frequency => "A" }|,
		"YPC@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:3", :col => "increment:3:1", :frequency => "A" }|,
		"YPCCE@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:5", :col => "increment:3:1", :frequency => "A" }|,
		"YPCCE_R@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:13", :col => "increment:3:1", :frequency => "A" }|,
		"YPCDPI@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:4", :col => "increment:3:1", :frequency => "A" }|,
		"YPCDPI_R@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:12", :col => "increment:3:1", :frequency => "A" }|,
		"N@US.A" => %Q|Series.load_from_download "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => "header:col:1:18", :col => "increment:3:1", :frequency => "A" }|,
		#"GDPDEF@US.A" => %Q|Series.load_from_download  "13A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 6, :col => "increment:3:1", :frequency => "A" }|, 
		#"YPC@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 10, :col => "increment:3:1", :frequency => "A" }|, 
		#"YPCDPI@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 11, :col => "increment:3:1", :frequency => "A" }|, 
		#"YPCCE@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 12, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDPPC@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 8, :col => "increment:3:1", :frequency => "A" }|, 
		#"GNPPC@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 9, :col => "increment:3:1", :frequency => "A" }|, 
		#"YPCDPI_R@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 19, :col => "increment:3:1", :frequency => "A" }|, 
		#"YPCCE_R@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 20, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDPPC_R@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 17, :col => "increment:3:1", :frequency => "A" }|, 
		#"GNPPC_R@US.A" => %Q|Series.load_from_download  "264A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 18, :col => "increment:3:1", :frequency => "A" }|, 
		#"GNP@US.A" => %Q|Series.load_from_download  "43A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 9, :col => "increment:3:1", :frequency => "A" }|, 
		#"GNP_R@US.A" => %Q|Series.load_from_download  "44A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 10, :col => "increment:3:1", :frequency => "A" }|, 
		#"Y@US.A" => %Q|Series.load_from_download  "58A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 6, :col => "increment:3:1", :frequency => "A" }|, 
		#"YDPI@US.A" => %Q|Series.load_from_download  "58A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 32, :col => "increment:3:1", :frequency => "A" }|, 
		#"YCE@US.A" => %Q|Series.load_from_download  "58A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 34, :col => "increment:3:1", :frequency => "A" }|, 
		#"YDPI_R@US.A" => %Q|Series.load_from_download  "58A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 42, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_C@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 7, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_CD@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 9, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_CN@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 10, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_CS@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 11, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_I@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 12, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_IFX@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 13, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_INR@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 14, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_IRS@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 17, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_IIV@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 18, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_NX@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 19, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_EX@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 20, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_IM@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 23, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_G@US.A" => %Q|Series.load_from_download  "5A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 26, :col => "increment:3:1", :frequency => "A" }|, 
		#"YCE_R@US.A" => %Q|Series.load_from_download  "66A@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 7, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_C_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 8, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_CD_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 10, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_CN_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 11, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_CS_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 12, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_I_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 13, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_IFX_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 14, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_INR_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 15, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_IRS_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 18, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_IIV_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 19, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_NX_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 20, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_EX_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 21, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_IM_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 24, :col => "increment:3:1", :frequency => "A" }|, 
		#"GDP_G_R@US.A" => %Q|Series.load_from_download  "6A@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 27, :col => "increment:3:1", :frequency => "A" }|, 
		"GDP@US.A" => %Q|Series.load_from_download  "us_gdp@bea.gov", { :file_type => "xls", :start_date => "1929-01-01", :sheet => "sheet_num:1", :row => "increment:9:1", :col => 2, :frequency => "A" }|, 
		"GDP_R@US.A" => %Q|Series.load_from_download  "us_gdp@bea.gov", { :file_type => "xls", :start_date => "1929-01-01", :sheet => "sheet_num:1", :row => "increment:9:1", :col => 3, :frequency => "A" }|, 
		# Can get more data, but our old series has more precision, so just reading the later dates
		# "CPI@CA.A" => %Q|Series.load_from_download  "ca_cpi@bea.gov", { :file_type => "xls", :start_date => "2000-01-01", :sheet => "sheet_num:1", :row => "increment:7:1", :col => 9, :frequency => "A" }|
		"CPI@CA.A" => %Q|Series.load_from_download  "ca_cpi@bea.gov", { :file_type => "xls", :start_date => "2000-01-01", :sheet => "sheet_num:1", :row => "increment:37:1", :col => 9, :frequency => "A" }|,
		# Ben added this, hopefully this is where this definition goes
		"INF@CA.A" => %Q|"CPI@CA.A".ts.annualized_percentage_change |
	}
	
	p = Packager.new
	p.add_definitions us_a
	p.write_definitions_to "#{ENV['DATA_PATH']}/us/update/us_upd_a_NEW.xls"
	CSV.open("public/rake_time.csv", "a") {|csv| csv << ["us_upd_a", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :us_upd_m => :environment do
  t = Time.now
	us_m = {
		###"N@US.M"" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => "header:col:1:40", :col => "increment:3:1", :frequency => "M" }|,
		#N@US.M is defined twice
		"Y@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => "header:col:1:1", :col => "increment:3:1", :frequency => "M" }|,
		"YCE@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => "header:col:1:29", :col => "increment:3:1", :frequency => "M" }|,
		"YCE_R@US.M" => %Q|Series.load_from_download  "83M@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => "header:col:1:1", :col => "increment:3:1", :frequency => "M" }|,
		"YDPI@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => "header:col:1:27", :col => "increment:3:1", :frequency => "M" }|,
		"YDPI_R@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => "header:col:1:37", :col => "increment:3:1", :frequency => "M" }|,
		"YPCDPI@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => "header:col:1:38", :col => "increment:3:1", :frequency => "M" }|,
		"YPCDPI_R@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => "header:col:1:39", :col => "increment:3:1", :frequency => "M" }|,
		
		#"Y@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => 6, :col => "increment:3:1", :frequency => "M" }|, 
		#"YDPI@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => 32, :col => "increment:3:1", :frequency => "M" }|, 
		#"YCE@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => 34, :col => "increment:3:1", :frequency => "M" }|, 
		#"YDPI_R@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => 42, :col => "increment:3:1", :frequency => "M" }|, 
		#"YPCDPI@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => 43, :col => "increment:3:1", :frequency => "M" }|, 
		#"YPCDPI_R@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => 44, :col => "increment:3:1", :frequency => "M" }|, 
		##{}"N@US.M" => %Q|Series.load_from_download  "76M@bea.gov", { :file_type => "csv", :start_date => "1959-01-01", :row => 45, :col => "increment:3:1", :frequency => "M" }|, 
		#N@US.M is defined twice
		#"YCE_R@US.M" => %Q|Series.load_from_download  "83M@bea.gov", { :file_type => "csv", :start_date => "1995-01-01", :row => 7, :col => "increment:3:1", :frequency => "M" }|, 

    "E_NF@US.M" => %Q|"E_NF@US.M".tsn.load_from_bls("CES0000000001", "M")|,
    "E_NFNS@US.M" => %Q|"E_NFNS@US.M".tsn.load_from_bls("CEU0000000001", "M")|,
    "E_PR@US.M" => %Q|"E_PR@US.M".tsn.load_from_bls("CES0500000001", "M")|,
    "E_PRNS@US.M" => %Q|"E_PRNS@US.M".tsn.load_from_bls("CEU0500000001", "M")|,
    "E_GDSPR@US.M" => %Q|"E_GDSPR@US.M".tsn.load_from_bls("CES0600000001", "M")|,
    "E_GDSPRNS@US.M" => %Q|"E_GDSPRNS@US.M".tsn.load_from_bls("CEU0600000001", "M")|,
    "E_SVCPR@US.M" => %Q|"E_SVCPR@US.M".tsn.load_from_bls("CES0700000001", "M")|,
    "E_SVCPRNS@US.M" => %Q|"E_SVCPRNS@US.M".tsn.load_from_bls("CEU0700000001", "M")|,
    "EMI@US.M" => %Q|"EMI@US.M".tsn.load_from_bls("CES1000000001", "M")|,
    "EMINS@US.M" => %Q|"EMINS@US.M".tsn.load_from_bls("CEU1000000001", "M")|,
    "ECT@US.M" => %Q|"ECT@US.M".tsn.load_from_bls("CES2000000001", "M")|,
    "ECTNS@US.M" => %Q|"ECTNS@US.M".tsn.load_from_bls("CEU2000000001", "M")|,
    "EMN@US.M" => %Q|"EMN@US.M".tsn.load_from_bls("CES3000000001", "M")|,
    "EMNNS@US.M" => %Q|"EMNNS@US.M".tsn.load_from_bls("CEU3000000001", "M")|,
    "EMNDR@US.M" => %Q|"EMNDR@US.M".tsn.load_from_bls("CES3100000001", "M")|,
    "EMNDRNS@US.M" => %Q|"EMNDRNS@US.M".tsn.load_from_bls("CEU3100000001", "M")|,
    "EMNND@US.M" => %Q|"EMNND@US.M".tsn.load_from_bls("CES3200000001", "M")|,
    "EMNNDNS@US.M" => %Q|"EMNNDNS@US.M".tsn.load_from_bls("CEU3200000001", "M")|,
    "E_TTU@US.M" => %Q|"E_TTU@US.M".tsn.load_from_bls("CES4000000001", "M")|,
    "E_TTUNS@US.M" => %Q|"E_TTUNS@US.M".tsn.load_from_bls("CEU4000000001", "M")|,
    "EWT@US.M" => %Q|"EWT@US.M".tsn.load_from_bls("CES4142000001", "M")|,
    "EWTNS@US.M" => %Q|"EWTNS@US.M".tsn.load_from_bls("CEU4142000001", "M")|,
    "ERT@US.M" => %Q|"ERT@US.M".tsn.load_from_bls("CES4200000001", "M")|,
    "ERTNS@US.M" => %Q|"ERTNS@US.M".tsn.load_from_bls("CEU4200000001", "M")|,
    "ETW@US.M" => %Q|"ETW@US.M".tsn.load_from_bls("CES4300000001", "M")|,
    "ETWNS@US.M" => %Q|"ETWNS@US.M".tsn.load_from_bls("CEU4300000001", "M")|,
    "EUT@US.M" => %Q|"EUT@US.M".tsn.load_from_bls("CES4422000001", "M")|,
    "EUTNS@US.M" => %Q|"EUTNS@US.M".tsn.load_from_bls("CEU4422000001", "M")|,
    "EIF@US.M" => %Q|"EIF@US.M".tsn.load_from_bls("CES5000000001", "M")|,
    "EIFNS@US.M" => %Q|"EIFNS@US.M".tsn.load_from_bls("CEU5000000001", "M")|,
    "E_FIR@US.M" => %Q|"E_FIR@US.M".tsn.load_from_bls("CES5500000001", "M")|,
    "E_FIRNS@US.M" => %Q|"E_FIRNS@US.M".tsn.load_from_bls("CEU5500000001", "M")|,
    "EFI@US.M" => %Q|"EFI@US.M".tsn.load_from_bls("CES5552000001", "M")|,
    "EFINS@US.M" => %Q|"EFINS@US.M".tsn.load_from_bls("CEU5552000001", "M")|,
    "ERE@US.M" => %Q|"ERE@US.M".tsn.load_from_bls("CES5553000001", "M")|,
    "ERENS@US.M" => %Q|"ERENS@US.M".tsn.load_from_bls("CEU5553000001", "M")|,
    "E_PBS@US.M" => %Q|"E_PBS@US.M".tsn.load_from_bls("CES6000000001", "M")|,
    "E_PBSNS@US.M" => %Q|"E_PBSNS@US.M".tsn.load_from_bls("CEU6000000001", "M")|,
    "EPS@US.M" => %Q|"EPS@US.M".tsn.load_from_bls("CES6054000001", "M")|,
    "EPSNS@US.M" => %Q|"EPSNS@US.M".tsn.load_from_bls("CEU6054000001", "M")|,
    "EMA@US.M" => %Q|"EMA@US.M".tsn.load_from_bls("CES6055000001", "M")|,
    "EMANS@US.M" => %Q|"EMANS@US.M".tsn.load_from_bls("CEU6055000001", "M")|,
    "EAD@US.M" => %Q|"EAD@US.M".tsn.load_from_bls("CES6056000001", "M")|,
    "EADNS@US.M" => %Q|"EADNS@US.M".tsn.load_from_bls("CEU6056000001", "M")|,
    "E_EDHC@US.M" => %Q|"E_EDHC@US.M".tsn.load_from_bls("CES6500000001", "M")|,
    "E_EDHCNS@US.M" => %Q|"E_EDHCNS@US.M".tsn.load_from_bls("CEU6500000001", "M")|,
    "EED@US.M" => %Q|"EED@US.M".tsn.load_from_bls("CES6561000001", "M")|,
    "EEDNS@US.M" => %Q|"EEDNS@US.M".tsn.load_from_bls("CEU6561000001", "M")|,
    "EHC@US.M" => %Q|"EHC@US.M".tsn.load_from_bls("CES6562000001", "M")|,
    "EHCNS@US.M" => %Q|"EHCNS@US.M".tsn.load_from_bls("CEU6562000001", "M")|,
    "E_LH@US.M" => %Q|"E_LH@US.M".tsn.load_from_bls("CES7000000001", "M")|,
    "E_LHNS@US.M" => %Q|"E_LHNS@US.M".tsn.load_from_bls("CEU7000000001", "M")|,
    "EAE@US.M" => %Q|"EAE@US.M".tsn.load_from_bls("CES7071000001", "M")|,
    "EAENS@US.M" => %Q|"EAENS@US.M".tsn.load_from_bls("CEU7071000001", "M")|,
    "EAF@US.M" => %Q|"EAF@US.M".tsn.load_from_bls("CES7072000001", "M")|,
    "EAFNS@US.M" => %Q|"EAFNS@US.M".tsn.load_from_bls("CEU7072000001", "M")|,
    "EAFAC@US.M" => %Q|"EAFAC@US.M".tsn.load_from_bls("CES7072100001", "M")|,
    "EAFACNS@US.M" => %Q|"EAFACNS@US.M".tsn.load_from_bls("CEU7072100001", "M")|,
    "EAFFD@US.M" => %Q|"EAFFD@US.M".tsn.load_from_bls("CES7072200001", "M")|,
    "EAFFDNS@US.M" => %Q|"EAFFDNS@US.M".tsn.load_from_bls("CEU7072200001", "M")|,
    "EOS@US.M" => %Q|"EOS@US.M".tsn.load_from_bls("CES8000000001", "M")|,
    "EOSNS@US.M" => %Q|"EOSNS@US.M".tsn.load_from_bls("CEU8000000001", "M")|,
    "EGV@US.M" => %Q|"EGV@US.M".tsn.load_from_bls("CES9000000001", "M")|,
    "EGVNS@US.M" => %Q|"EGVNS@US.M".tsn.load_from_bls("CEU9000000001", "M")|,
    "EGVFD@US.M" => %Q|"EGVFD@US.M".tsn.load_from_bls("CES9091000001", "M")|,
    "EGVFDNS@US.M" => %Q|"EGVFDNS@US.M".tsn.load_from_bls("CEU9091000001", "M")|,
    "EGVST@US.M" => %Q|"EGVST@US.M".tsn.load_from_bls("CES9092000001", "M")|,
    "EGVSTNS@US.M" => %Q|"EGVSTNS@US.M".tsn.load_from_bls("CEU9092000001", "M")|,
    "EGVLC@US.M" => %Q|"EGVLC@US.M".tsn.load_from_bls("CES9093000001", "M")|,
    "EGVLCNS@US.M" => %Q|"EGVLCNS@US.M".tsn.load_from_bls("CEU9093000001", "M")|,
    "LF@US.M" => %Q|"LF@US.M".tsn.load_from_bls("LNS11000000", "M")|,
    "LFNS@US.M" => %Q|"LFNS@US.M".tsn.load_from_bls("LNU01000000", "M")|,
    "EMPL@US.M" => %Q|"EMPL@US.M".tsn.load_from_bls("LNS12000000", "M")|,
    "EMPLNS@US.M" => %Q|"EMPLNS@US.M".tsn.load_from_bls("LNU02000000", "M")|,
    "UR@US.M" => %Q|"UR@US.M".tsn.load_from_bls("LNS14000000", "M")|,
    "URNS@US.M" => %Q|"URNS@US.M".tsn.load_from_bls("LNU04000000", "M")|,
    "UR@CA.M" => %Q|"UR@CA.M".tsn.load_from_bls("LASST06000003", "M")|,
    "EMPL@CA.M" => %Q|"EMPL@CA.M".tsn.load_from_bls("LASST06000005", "M")|,
    "LF@CA.M" => %Q|"LF@CA.M".tsn.load_from_bls("LASST06000006", "M")|,
    "URNS@CA.M" => %Q|"URNS@CA.M".tsn.load_from_bls("LAUST06000003", "M")|,
    "EMPLNS@CA.M" => %Q|"EMPLNS@CA.M".tsn.load_from_bls("LAUST06000005", "M")|,
    "LFNS@CA.M" => %Q|"LFNS@CA.M".tsn.load_from_bls("LAUST06000006", "M")|,
    "ENF@CA.M" => %Q|"ENF@CA.M".tsn.load_from_bls("SMS06000000000000001", "M")|,
    "ENFNS@CA.M" => %Q|"ENFNS@CA.M".tsn.load_from_bls("SMU06000000000000001", "M")|,
    "CPI@US.M" => %Q|"CPI@US.M".tsn.load_from_bls("CUSR0000SA0", "M")|,
    "CPINS@US.M" => %Q|"CPINS@US.M".tsn.load_from_bls("CUUR0000SA0", "M")|,
    "CPICORE@US.M" => %Q|"CPICORE@US.M".tsn.load_from_bls("CUSR0000SA0L1E", "M")|,
    "CPICORENS@US.M" => %Q|"CPICORENS@US.M".tsn.load_from_bls("CUUR0000SA0L1E", "M")|,
		"CAPU@US.M" => %Q|Series.load_from_download  "US_CAPU_M@research.stlouisfed.org", { :file_type => "txt" , :frequency => "M"}|, 
		"EXUSEU@US.M" => %Q|Series.load_from_download  "US_EXUSEU_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"HOUST@US.M" => %Q|Series.load_from_download  "US_HOUST_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"IP@US.M" => %Q|Series.load_from_download  "US_IP_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"M2@US.M" => %Q|Series.load_from_download  "US_M2_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"M2NS@US.M" => %Q|Series.load_from_download  "US_M2NS_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"N@US.M" => %Q|Series.load_from_download  "US_N_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"PCE@US.M" => %Q|Series.load_from_download  "US_PCE_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"PCECORE@US.M" => %Q|Series.load_from_download  "US_PCECORE_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"POIL@US.M" => %Q|Series.load_from_download  "US_POIL_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"RAAANS@US.M" => %Q|Series.load_from_download  "US_RAAANS_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"RFED@US.M" => %Q|Series.load_from_download  "US_RFED_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"RILGFCY10@US.M" => %Q|Series.load_from_download  "US_RILGFCY10_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"RMORT@US.M" => %Q|Series.load_from_download  "US_RMORT_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"UMCSENT@US.M" => %Q|Series.load_from_download  "US_UMCSENT_M@research.stlouisfed.org", { :file_type => "txt", :frequency => "M" }|, 
		"YXR@JP.M" => %Q|Series.load_from_fred("EXJPUS", "M")|,
	"STKNS@US.M" => %Q| Series.load_from_download  "US_STKNS@yahoo.com", { :file_type => "csv", :start_row => 3, :start_col => 1, :rev => true , :row => "increment:3:1", :col => "7", :frequency => "M" }|,
	
	}
	
	
	us_m_special = {
	
	"STKNS@US.M" => %Q| Series.load_from_download  "US_STKNS@yahoo.com", { :file_type => "csv", :start_row => 3, :start_col => 1, :rev => true , :row => "increment:3:1", :col => "7", :frequency => "M" }|
		#STKNS starts on row 3 rather than row 2 to capture only fully-completed months
		
	}
	

	p = Packager.new
	p.add_definitions us_m
	p.write_definitions_to "#{ENV['DATA_PATH']}/us/update/us_upd_m_NEW.xls"

	p = Packager.new
	p.add_definitions us_m_special
	p.write_definitions_to "#{ENV['DATA_PATH']}/us/update/us_upd_m2_NEW.xls"


	CSV.open("public/rake_time.csv", "a") {|csv| csv << ["us_upd_m", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
end

