require 'spec_helper'


#Most of this functionality seems to be more related to series, but maybe that's ok

describe DataSource do
  before(:all) do
    Geography.create!({ handle: 'HI', display_name: 'State of Hawaii', display_name_short: 'Hawaii' }) rescue nil
    Geography.create!({ handle: 'HAW', display_name: 'Hawaii County', display_name_short: 'Big Island' }) rescue nil
    Geography.create!({ handle: 'KAU', display_name: 'Kauai County', display_name_short: 'Garden Isle' }) rescue nil
    Geography.create!({ handle: 'MAU', display_name: 'Maui County', display_name_short: 'Valley Isle' }) rescue nil
    Geography.create!({ handle: 'HON', display_name: 'C & C of Honolulu', display_name_short: 'Gathering Place' }) rescue nil
    Geography.create!({ handle: 'TEST', display_name: 'State of Test', display_name_short: 'Test' }) rescue nil
    @data1_hash = "YSTWTR@HI.A".tsn.load_from("#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls").data
    @data1_no_nil = @data1_hash.clone
    @data1_no_nil.delete_if {|key,value| value.nil?}

    @data2_hash = "YSTWTT@HI.A".tsn.load_from("#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls").data
    @data2_no_nil = @data2_hash.clone
    @data2_no_nil.delete_if {|key,value| value.nil?}
  end

  before(:each) do
    Geography.create!({ handle: 'HI', display_name: 'State of Hawaii', display_name_short: 'Hawaii' }) rescue nil
    Geography.create!({ handle: 'HAW', display_name: 'Hawaii County', display_name_short: 'Big Island' }) rescue nil
    Geography.create!({ handle: 'KAU', display_name: 'Kauai County', display_name_short: 'Garden Isle' }) rescue nil
    Geography.create!({ handle: 'MAU', display_name: 'Maui County', display_name_short: 'Valley Isle' }) rescue nil
    Geography.create!({ handle: 'HON', display_name: 'C & C of Honolulu', display_name_short: 'Gathering Place' }) rescue nil
    Geography.create!({ handle: 'TEST', display_name: 'State of Test', display_name_short: 'Test' }) rescue nil
  end

  xit "should create a source when append syntax is used" do
    "YSTWTR@HI.A".ts_append_eval %Q|"YSTWTR@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|
    "YSTWTR@HI.A".ts.data_sources.count.should == 1
    "YSTWTR@HI.A".ts.data_sources.first.eval.should_not be_nil
    "YSTWTR@HI.A".ts.data_sources.first.description.should == "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"
    "YSTWTR@HI.A".ts.data_sources.first.series_id.should == "YSTWTR@HI.A".ts.id
    "YSTWTR@HI.A".ts.identical_to?("YSTWTR@HI.A".ts.data_sources.first.data).should be_true
    
  end
  
  it "should have two sources when eval syntax is followed by append syntax" do
    Series.store("YSTWTR@HI.A", Series.new(:data => @data1_hash),"desc1", %Q|"YSTWTR@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|)
    Series.store("YSTWTR@HI.A", Series.new(:data => @data2_hash),"desc2", %Q|"YSTWTT@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|)    
    "YSTWTR@HI.A".ts.data_sources.count.should == 2
  end
     
  xit "should delete all dependent data points if it is deleted and regenerate the data hash for the series" do
    "YSTWTR@HI.A".ts_eval= %Q|"YSTWTR@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|
    
    "YSTWTR@HI.A".ts.data_points.count.should == @data1_no_nil.count
    "YSTWTR@HI.A".ts.data_sources[0].data_points.count.should == @data1_no_nil.count

    "YSTWTR@HI.A".ts_append_eval %Q|"YSTWTT@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|
    "YSTWTR@HI.A".ts.data_sources.count.should == 2

    ds0 = "YSTWTR@HI.A".ts.data_sources_by_last_run[0]
    ds1 = "YSTWTR@HI.A".ts.data_sources_by_last_run[1]
    dps0 = ds0.data_points
    dps1 = ds1.data_points
    
    "YSTWTR@HI.A".ts.data_points.count.should == @data1_no_nil.count + @data2_no_nil.count
    dps0.count.should == @data1_no_nil.count
    dps1.count.should == @data2_no_nil.count

    ### NOTE: The following DataPoint.find_by statements cannot succeed, because 'id' column has been removed
    ### from the data_points table!  If you want to reenable this test, you'll need to rewrite the below part.
    DataPoint.find_by(id: dps0[0].id).should_not be_nil
    DataPoint.find_by(id: dps1[0].id).should_not be_nil
    ds1.delete
    "YSTWTR@HI.A".ts.data_sources.count.should == 1

    ds0 = "YSTWTR@HI.A".ts.data_sources_by_last_run[0]    
    
    "YSTWTR@HI.A".ts.data_points.count.should == @data1_no_nil.count
    ds0.data_points.count.should == @data1_no_nil.count
    
    DataPoint.find_by(id: dps1[0].id).first.should be_nil
    DataPoint.find_by(id: dps0[0].id).should_not be_nil
  end
    

  it "should recognize that a source with the exact same eval statement is the same and use the same source" do
    Series.store("YSTWTR@HI.A", Series.new(:data => @data1_hash),"desc1", %Q|"YSTWTR@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|)
    source = "YSTWTR@HI.A".ts.data_sources[0]
    Series.store("YSTWTR@HI.A", Series.new(:data => @data1_hash),"desc1", %Q|"YSTWTR@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|)
    "YSTWTR@HI.A".ts.data_sources.count.should == 1
    source.id.should == "YSTWTR@HI.A".ts.data_sources[0].id
  end

  xit "should be able to retrieve series in order of earliest last run to latest last run" do
    Series.store("YSTWTR@HI.A", Series.new(:data => @data1_hash),"desc1", %Q|"YSTWTR@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|)
    Series.store("YSTWTR@HI.A", Series.new(:data => @data2_hash),"desc2", %Q|"YSTWTT@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|)    
    sleep 1
    "YSTWTR@HI.A".ts_append_eval %Q|"YSTWTG@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls "|
    "YSTWTR@HI.A".ts.data_sources.count.should == 3
    ("YSTWTR@HI.A".ts.data_sources.sort_by(&:last_run)[0].last_run < "YSTWTR@HI.A".ts.data_sources.sort_by(&:last_run)[-1].last_run).should be_true
  end

    #turn off "setting" data sources. Now that we can delete sources and data points. All sources should be appended
   xit "should mark data points as history if they are attached to current data source, but the date is not in the source data hash" do
     #Series.store(series_name, series, mode, desc=nil, eval_statement=nil)
     delete_date = "2000-01-01"
     dummy_series = "YSTWTT@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"

     Series.store("YSTWTR@HI.A", dummy_series, "dummy series description", "dummy")

     new_data = dummy_series.data.clone
     new_data.delete(delete_date)
     new_series = Series.new(:data => new_data)
     Series.store("YSTWTR@HI.A", new_series, "dummy series description", "dummy")

     history = "YSTWTR@HI.A".ts.data_points.where(:date => delete_date).first.history
     history.should_not be_nil
     history.to_date.should == Time.now.to_date
   end

  it "should be able to determine a color for itself" do
    Series.store("YSTWTR@HI.A", Series.new(:data => @data2_hash),"desc2", %Q|"YSTWTT@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|)    
    Series.store("YSTWTR@HI.A", Series.new(:data => @data1_hash),"desc1", %Q|"YSTWTR@HI.A".tsn.load_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/gsp_upd.xls"|)
    
    ds_first = "YSTWTR@HI.A".ts.data_sources_by_last_run[0]
    ds_second = "YSTWTR@HI.A".ts.data_sources_by_last_run[1]
    
    ds_first.color.should == "FFCC99"
    ds_second.color.should == "CCFFFF"
  end
  
end

