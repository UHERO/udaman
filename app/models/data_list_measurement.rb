class DataListMeasurement < ActiveRecord::Base
  enum indent: { indent0: 'indent0', indent1: 'indent1', indent2: 'indent2' }
  belongs_to :data_list
  belongs_to :measurement
end
