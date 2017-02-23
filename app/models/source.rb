class Source < ActiveRecord::Base
  has_many :series
  has_many :measurements
end
