require 'spec_helper'
require 'spec_data_hash.rb'

describe SeriesInterpolation do
  
  before(:all) do
    @dh = get_data_hash
    @data_files_path = "#{ENV["DATAFILES_PATH"]}/datafiles/"
  end
  
  describe "performing LINEAR INTERPOLATION" do
    xit "should raise an error if the series is not semi annual" do
      ones = @dh.ns "ONES@TEST.Q"
      lambda {ones.interpolate :quarter, :linear}.should raise_error InterpolationException
    end
  
    xit "should raise an error if the requested interpolation is not quarterly" do
      semi_to_interpolate = @dh.ns "PCEN@HON.S"
      lambda {semi_to_interpolate.interpolate :monthly, :linear}.should raise_error InterpolationException
    end
  
    xit "should raise an error if the requested interpolation style is not linear" do
      semi_to_interpolate = @dh.ns "PCEN@HON.S"
      lambda {semi_to_interpolate.interpolate :quarter, :other}.should raise_error InterpolationException
    end
  
  end

end
