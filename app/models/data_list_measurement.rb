class DataListMeasurement < ActiveRecord::Base
  enum indent: { none: 'none', ind1: 'ind1', ind2: 'ind2' }
  belongs_to :data_list
  belongs_to :measurement
end
