class DataListMeasurement < ActiveRecord::Base
  enum indent: { indent0: 'indent0', indent1: 'indent1', indent2: 'indent2', indent3: 'indent3' }
  belongs_to :data_list
  belongs_to :measurement
end
