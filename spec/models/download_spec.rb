require 'spec_helper'

describe Download do
  before(:each) do
    #@s = Series.create
  end
  
  #all of these download samples should eventually be files that do not rely on external maintenance of files
  xit "should successfully download an XLS File and should save the file to the specified path" do
    download_url = "http://www.dof.ca.gov/HTML/FS_DATA/LatestEconData/documents/BBCYCPI.xls"    
    save_path = "#{ENV["DATAFILES_PATH"]}/datafiles/specs_output/downloads/ds_test.xls"
    dsd = Download.new(:url => download_url, :post_parameters => {}, :save_path => save_path)
    dsd.download
    File::file?(save_path).should be_true
    (Time.now - File::ctime(save_path)).should be_within(5).of(0)
  end
  
  #this format did not work as a uri for some reason
  #download_url = "http://ichart.finance.yahoo.com/table.csv?s=^GSPC&a=09&b=1&c=1982&d=11&e=31&f=2010&g=d&ignore=.csv"
  xit "should successfully download a CSV File and should save the file to the specified path" do
    download_url = "http://www.meti.go.jp/english/statistics/tyo/iip/csv/ha2gsm2e.csv"
    save_path = "#{ENV["DATAFILES_PATH"]}/datafiles/specs_output/downloads/ds_test.csv"
    dsd = Download.new(:url => download_url, :post_parameters => {}, :save_path => save_path)
    dsd.download
    File::file?(save_path).should be_true
    (Time.now - File::ctime(save_path)).should be_within(5).of(0)
  end
  
  xit "should successfully download a Text File and should save the file to the specified path" do
    download_url = "http://research.stlouisfed.org/fred2/series/EXJPUS/downloaddata/EXJPUS.txt"
    save_path = "#{ENV["DATAFILES_PATH"]}/datafiles/specs_output/downloads/ds_test.txt"
    dsd = Download.new(:url => download_url, :post_parameters => {}, :save_path => save_path)
    dsd.download
    File::file?(save_path).should be_true
    (Time.now - File::ctime(save_path)).should be_within(5).of(0)
  end
  
  xit "should successfully download an HTML File and should save the file to the specified path" do
    download_url = "http://blackmagicianproject.tripod.com/kaurent/Apartments100314.htm"
    save_path = "#{ENV["DATAFILES_PATH"]}/datafiles/specs_output/downloads/ds_test.html"
    dsd = Download.new(:url => download_url, :post_parameters => {}, :save_path => save_path)
    dsd.download
    File::file?(save_path).should be_true
    (Time.now - File::ctime(save_path)).should be_within(5).of(0)
  end
  
  xit "should download a file requiring https and should save the file to the specified path" do
    download_url = "https://www.hiwi.org/admin/gsipub/htmlarea/uploads/LFR_CES_JC2010.xls"
    save_path = "#{ENV["DATAFILES_PATH"]}/datafiles/specs_output/downloads/ds_test_https.xls"
    dsd = Download.new(:url => download_url, :post_parameters => {}, :save_path => save_path)
    dsd.download
    File::file?(save_path).should be_true
    (Time.now - File::ctime(save_path)).should be_within(5).of(0)
  end
  
  xit "should download a uri with special characters and save the file to the specified path" do
    download_url = "http://ichart.finance.yahoo.com/table.csv?s=^GSPC&a=09&b=1&c=1982&d=11&e=31&f=2010&g=d&ignore=.csv"
    save_path = "#{ENV["DATAFILES_PATH"]}/datafiles/specs_output/downloads/ds_test_bad_uri.xls"
    dsd = Download.new(:url => download_url, :post_parameters => {}, :save_path => save_path)
    dsd.download
    File::file?(save_path).should be_true
    (Time.now - File::ctime(save_path)).should be_within(5).of(0)
  end
  
  xit "should download a file requiring post parameters and should save the file to the specified path" do
    download_url = 'http://data.bls.gov/pdq/SurveyOutputServlet'
    save_path = "#{ENV["DATAFILES_PATH"]}/datafiles/specs_output/downloads/ds_test_post.html"
    post_params = { "series_id" 	=> "CES0000000001",
                    "delimeter"  	=> "tab",
                    "data_tool" 	=> "srgate",
                    "years_option" 	=> "all_years",
                    "output_type" 	=> "column",
                    "periods_option" 	=> "all_periods",
                    "output_format" 	=> "text",
                    "reformat" 		=> "true",
                    "initial_request" 	=> "false"
                  }
    dsd = Download.new(:url => download_url, :post_parameters => post_params, :save_path => save_path)
    dsd.download
    File::file?(save_path).should be_true
    (Time.now - File::ctime(save_path)).should be_within(5).of(0)
  end
  
  xit "should add a new log entry each time the file is downloaded" do
    download_url = "http://www.dof.ca.gov/HTML/FS_DATA/LatestEconData/documents/BBCYCPI.xls"    
    save_path = "#{ENV["DATAFILES_PATH"]}/datafiles/specs_output/downloads/ds_test.xls"
    dsd = Download.new(:url => download_url, :post_parameters => {}, :save_path => save_path)
    dsd.download
    dsd.download_log.count.should == 1
    dsd.download
    dsd.download
    dsd.download_log.count.should == 3
    dsd.download_log[0][:url].should == dsd.url
  end
  
  xit "should backup the vintages for each file into a directory" do
    download_url = "http://www.dof.ca.gov/HTML/FS_DATA/LatestEconData/documents/BBCYCPI.xls"    
    save_path = "#{ENV["DATAFILES_PATH"]}/datafiles/specs_output/downloads/ds_test.xls"
    dsd = Download.new(:url => download_url, :post_parameters => {}, :save_path => save_path)
    dsd.download
    dsd.backup
    date = Date.today
    filename = save_path.split("/")[-1]
    File::directory?(save_path+"_vintages").should be_true
    File::file?(save_path+"_vintages/#{date}_"+filename).should be_true
    (Time.now - File::ctime(save_path+"_vintages/#{date}_"+filename)).should be_within(5).of(0)
    
  end
  
  it "should take a post_param string" do
    post_param = %Q|"series_id" 	=> "CES0000000001",
                    "delimeter"  	=> "tab",
                    "data_tool" 	=> "srgate",
                    "years_option" 	=> "all_years",
                    "output_type" 	=> "column",
                    "periods_option" 	=> "all_periods",
                    "output_format" 	=> "text",
                    "reformat" 		=> "true",
                    "initial_request" 	=> "false"|
    dsd = Download.new
    dsd.process_post_params post_param
    dsd.post_parameters.count.should == 9
    dsd.post_parameters["series_id"].should == "CES0000000001"
  end
  
  it "should covert post_parameters into a string" do
    post_param = %Q|'initial_request'=>'false',\n'series_id'=>'CES0000000001'|
    dsd = Download.new
    dsd.process_post_params post_param
    dsd.post_param_string.should == post_param
  end
  
  xit "should be able to test its url and verify that url is reachable" do
    download_url = "http://www.dof.ca.gov/HTML/FS_DATA/LatestEconData/documents/BBCYCPI.xls"    
    dsd = Download.new(:url => download_url, :post_parameters => {})
    dsd.test_url.should == 200
  end
  
  it "should be able to test its url and notify user that url is invalid" do
    download_url = ".dof.ca.gov/HTML/FS_DATA/LatestEconData/documents/BBCYCPI.xls"    
    dsd = Download.new(:url => download_url, :post_parameters => {})
    dsd.test_url.should be_nil
  end
  
  xit "should be able to test its url and notify user if an error code other than 200 is reached" do
    download_url = "http://data.bls.gov/pdq/SurveyOutputServlet"    
    dsd = Download.new(:url => download_url, :post_parameters => {})
    dsd.test_url.should == 302
  end
  
  it "should be able to test its download location and notify user if that path already exists" do
    dl1 = Download.create(:handle => 'dup_handle', :url => 'http://foo.com/mydata.xls', :filename_ext => 'xls')
    dl2 = Download.create(:handle => 'dup_handle', :url => 'http://foo.com/mydata.xls', :filename_ext => 'xls')
    dl2.test_save_path.should == "duplicate"
  end
  
  it "should be able to test its download location and notify user that path is ok" do
    dl = Download.create(:handle => 'ok_handle', :url => 'http://foo.com/mydata.xls', :filename_ext => 'xls')
    dl.test_save_path.should == "ok"
  end
  
  xit "should verify if the post parameters format is ok" do
    post_param = %Q|"series_id" 	=> "CES0000000001",
                    "delimeter"  	=> "tab",
                    "data_tool" 	=> "srgate",
                    "years_option" 	=> "all_years",
                    "output_type" 	=> "column",
                    "periods_option" 	=> "all_periods",
                    "output_format" 	=> "text",
                    "reformat" 		=> "true",
                    "initial_request" 	=> "false"|
    Download.test_post_params(post_param).should be_true
  end
  
  xit "should indicate that the post parameters format is not ok" do
    post_param = %Q|"series_id" 	=> "CES0000000001",
                    "delimeter"  	=> "tab",
                    "data_tool" 	=> "srgate",
                    "years_option" 	=> "all_years",
                    "output_type" 	=> "column",
                    "periods_option" 	=> "all_periods",
                    "output_format" 	=> "text",
                    "reformat" 		=> "true",
                    "initial_request" 	=> "false", "wefwe"  |
    lambda {Download.test_post_params(post_param)}.should raise_error SyntaxError
  end
end
