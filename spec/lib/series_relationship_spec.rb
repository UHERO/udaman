require 'spec_helper'

#this might be the slowest set of tests takes a full 60 seconds
#try several different create statements
#time results from creating
describe SeriesRelationship do
  before(:all) do
  end

  describe "CLEANING DATA SOURCE operations" do
  
    before(:each) do
      Geography.create!({ handle: 'HI', display_name: 'State of Hawaii', display_name_short: 'Hawaii' }) rescue nil
      Geography.create!({ handle: 'HAW', display_name: 'Hawaii County', display_name_short: 'Big Island' }) rescue nil
      Geography.create!({ handle: 'KAU', display_name: 'Kauai County', display_name_short: 'Garden Isle' }) rescue nil
      Geography.create!({ handle: 'MAU', display_name: 'Maui County', display_name_short: 'Valley Isle' }) rescue nil
      Geography.create!({ handle: 'HON', display_name: 'C & C of Honolulu', display_name_short: 'Gathering Place' }) rescue nil
      Geography.create!({ handle: 'TEST', display_name: 'State of Test', display_name_short: 'Test' }) rescue nil
      Series.load_all_series_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/ECT.xls"
    end
  
    it "should remove the unused data source from a series with two data sources" do
      "VISJPDEMETRANS@HI.M".ts_append_eval %Q|"VISJPNS@HI.M".ts|
      "VISJPDEMETRANS@HI.M".ts.data_sources.count.should == 2
      "VISJPDEMETRANS@HI.M".ts.clean_data_sources
      "VISJPDEMETRANS@HI.M".ts.data_sources.count.should == 1
    end
  
    #could probably split this test up into two pieces
    xit "should remove the unused data source from a series with three data sources" do

      "VISJPDEMETRA@HI.M".ts_append_eval %Q|"VISJPDEMETRANS@HI.M".ts|
      "VISJPDEMETRANS@HI.M".ts_append_eval %Q|"VISJPNS@HI.M".ts|

      "VISJPDEMETRA@HI.M".ts_append_eval %Q|"VISJPDEMETRA@HI.M".ts.load_mean_corrected_sa_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/ECT.xls", "Sheet1"|
      "VISJPDEMETRA@HI.M".ts_append_eval %Q|"VISJPDEMETRA@HI.M".ts.apply_seasonal_adjustment :multiplicative|
      "VISJPDEMETRA@HI.M".ts.data_sources.count.should == 3
      "VISJPDEMETRA@HI.M".ts.clean_data_sources
      "VISJPDEMETRA@HI.M".ts.data_sources.count.should == 2 #should just be the seasonal adjustement and mean corrected SA
    end
  
    it "should leave a series with one used datasources alone" do
      "VISJP@HI.M".ts.data_sources.count.should == 1
      "VISJP@HI.M".ts.clean_data_sources
      "VISJP@HI.M".ts.data_sources.count.should == 1
    end
  end

  describe "reporting DEPENDENTS and DEPENDENCIES" do
    before(:each) do
      Geography.create!({ handle: 'HI', display_name: 'State of Hawaii', display_name_short: 'Hawaii' }) rescue nil
      Geography.create!({ handle: 'HAW', display_name: 'Hawaii County', display_name_short: 'Big Island' }) rescue nil
      Geography.create!({ handle: 'KAU', display_name: 'Kauai County', display_name_short: 'Garden Isle' }) rescue nil
      Geography.create!({ handle: 'MAU', display_name: 'Maui County', display_name_short: 'Valley Isle' }) rescue nil
      Geography.create!({ handle: 'HON', display_name: 'C & C of Honolulu', display_name_short: 'Gathering Place' }) rescue nil
      Geography.create!({ handle: 'TEST', display_name: 'State of Test', display_name_short: 'Test' }) rescue nil
      Series.load_all_series_from "#{ENV["DATAFILES_PATH"]}/datafiles/specs/ECT.xls"
    end
  
    it "should recognize a component series as a dependency" do
      "ECT_DEPENDENT@HI.M".ts_append_eval %Q|"ECT@HON.M".ts + 1|
      "ECT_DEPENDENT@HI.M".ts.who_i_depend_on.include?("ECT@HON.M").should eq(true)
    end
  
    it "should recognize dependents when it is a component series for another" do
      "ECT_DEPENDENT@HI.M".ts_append_eval %Q|"ECT@HON.M".ts + 1|
      Series.who_depends_on('ECT@HON.M').include?("ECT_DEPENDENT@HI.M").should eq(true)
    end
  
    it "should recognize component series of multiple sources in the dependencies array" do
      "ECT_DEPENDENT@HI.M".ts_append_eval %Q|"ECT@HON.M".ts + 1|
      "ECT_DEPENDENT@HI.M".ts_append_eval %Q|"ECT_CALC@HON.M".ts + 1|
      who_i_dep = "ECT_DEPENDENT@HI.M".ts.who_i_depend_on
      who_i_dep.include?("ECT@HON.M").should eq(true)
      who_i_dep.include?("ECT_CALC@HON.M").should eq(true)
    end
  
    it "should recognize multiple dependents when it is a component for multiple series" do
      "ECT_DEPENDENT@HI.M".ts_append_eval %Q|"ECT@HON.M".ts + 1|
      "ECT_DEPENDENT2@HI.M".ts_append_eval %Q|"ECT@HON.M".ts + 1|
      who_deps_me = Series.who_depends_on('ECT@HON.M')
      who_deps_me.include?("ECT_DEPENDENT@HI.M").should eq(true)
      who_deps_me.include?("ECT_DEPENDENT2@HI.M").should eq(true)
      who_deps_me.include?("ECT_NON_EXIST@HI.M").should eq(false)
    end
  end
end
