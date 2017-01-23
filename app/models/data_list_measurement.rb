class DataListMeasurement < ActiveRecord::Base
  enum indent: { 0, 1, 2 }
  belongs_to :data_list
  belongs_to :measurement
end