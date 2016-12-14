class DataListMeasurement < ActiveRecord::Base
  belongs_to :data_list
  belongs_to :measurement
end