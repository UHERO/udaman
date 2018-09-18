class SourceDetail < ActiveRecord::Base
  include Cleaning
  has_many :series
  has_many :measurements
end
