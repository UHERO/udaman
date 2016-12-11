class Measurement < ActiveRecord::Base
  has_many :series
end
