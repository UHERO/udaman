require 'spec_helper'

#figure out what to do with error conditions in these tests
describe DatePatternProcessor do  
  
  it "should compute the index of a given date for an annual pattern" do
    dpp = DatePatternProcessor.new("2000-01-01", "A", false)
    expect(dpp.compute_index_for_date("2005-01-01")).to eq(5)
  end

  it "should compute the index of a given date for an semi-annual pattern" do
    dpp = DatePatternProcessor.new("2000-01-01", "S", false)
    expect(dpp.compute_index_for_date("2005-01-01")).to eq(10)
  end
  
  it "should compute the index of a given date for an quarterly pattern" do
    dpp = DatePatternProcessor.new("2000-01-01", "Q", false)
    expect(dpp.compute_index_for_date("2005-01-01")).to eq(20)
  end
  
  it "should compute the index of a given date for an monthly pattern" do
    dpp = DatePatternProcessor.new("2000-01-01", "M", false)
    expect(dpp.compute_index_for_date("2005-01-01")).to eq(60)
  end
  
  it "should compute the index of a given date for an weekly pattern" do
    dpp = DatePatternProcessor.new("2000-01-01", "W", false)
    expect(dpp.compute_index_for_date("2000-01-15")).to eq(2)
  end
  
  it "should compute the index of a given date for an daily pattern" do
    dpp = DatePatternProcessor.new("2000-01-01", "D", false)
    expect(dpp.compute_index_for_date("2000-01-16")).to eq(15)
  end
  
  it "should compute the date for a given index for a weekday pattern in reverse" do
    dpp = DatePatternProcessor.new("2011-08-26", "WD", true) #friday
    expect(dpp.compute(32)).to eq("2011-07-13")
    expect(dpp.compute(5)).to eq("2011-08-19")
    dpp = DatePatternProcessor.new("2011-08-25", "WD", true) #thursday
    expect(dpp.compute(31)).to eq("2011-07-13")
    expect(dpp.compute(5)).to eq("2011-08-18")
    dpp = DatePatternProcessor.new("2011-08-24", "WD", true) #wednesday
    expect(dpp.compute(30)).to eq("2011-07-13")
    expect(dpp.compute(5)).to eq("2011-08-17")
    dpp = DatePatternProcessor.new("2011-08-23", "WD", true) #tuesday
    expect(dpp.compute(29)).to eq("2011-07-13")
    expect(dpp.compute(5)).to eq("2011-08-16")
    dpp = DatePatternProcessor.new( "2011-08-22", "WD", true) #monday
    expect(dpp.compute(28)).to eq("2011-07-13")
    expect(dpp.compute(5)).to eq("2011-08-15")
  end
  
  it "should compute the index of a given date for a weekday pattern in reverse" do
    dpp = DatePatternProcessor.new("2011-08-26", "WD", true) #friday
    expect(dpp.compute_index_for_date("2011-07-13")).to eq(32)
    expect(dpp.compute_index_for_date("2011-08-19")).to eq(5)
    dpp = DatePatternProcessor.new("2011-08-25", "WD", true) #thursday
    expect(dpp.compute_index_for_date("2011-07-13")).to eq(31)
    expect(dpp.compute_index_for_date("2011-08-18")).to eq(5)
    dpp = DatePatternProcessor.new("2011-08-24", "WD", true) #wednesday
    expect(dpp.compute_index_for_date("2011-07-13")).to eq(30)
    expect(dpp.compute_index_for_date("2011-08-17")).to eq(5)
    dpp = DatePatternProcessor.new("2011-08-23", "WD", true) #tuesday
    expect(dpp.compute_index_for_date("2011-07-13")).to eq(29)
    expect(dpp.compute_index_for_date("2011-08-16")).to eq(5)
    dpp = DatePatternProcessor.new("2011-08-22", "WD", true) #monday
    expect(dpp.compute_index_for_date("2011-07-13")).to eq(28)
    expect(dpp.compute_index_for_date("2011-08-15")).to eq(5)
  end
  
end
