class Measurement < ActiveRecord::Base
  has_many :series
  has_and_belongs_to_many :data_lists
end
