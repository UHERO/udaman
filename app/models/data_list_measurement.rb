class DataListMeasurement < ActiveRecord::Base
  enum indent: { none: 'none', indent1: 'indent1', indent2: 'indent2' }
  belongs_to :data_list
  belongs_to :measurement
end
