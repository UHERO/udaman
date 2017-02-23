class SourceDetail < ActiveRecord::Base
  has_many :series
  has_many :measurements
end
