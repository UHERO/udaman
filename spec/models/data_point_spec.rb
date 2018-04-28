require 'spec_helper'

describe DataPoint do
  before(:each) do
    @s = Series.create
  end
  
  #redo tests above without the update function
  it 'should NOT change data_point if value and source_id are unchanged' do
    ds = DataSource.create priority: 80
    arbitrary_id = 99  ## anything other than zero
    dp = DataPoint.create(id: arbitrary_id,
                          :series_id => @s.id, :date => '2011-03-01', :value => 100.0, :data_source_id => ds.id, :current => true)
    newdp = dp.upd(100, ds)
    cur_dps = @s.current_data_points
### this is not done yet
    dpu = @s.current_data_points.first
    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp).to eq(nil)
    expect(cur_dps.first.id).to eq(arbitrary_id), 'current dp is a different from original'
    expect(dp.current).to eq(true), 'old data point no longer current'
  end

  it 'should update a data_points data source if source is different, source.priority not < current' do
    ds1 = DataSource.create priority: 80
    ds2 = DataSource.create priority: 80
    arbitrary_id = 99  ## anything other than zero
    dp = DataPoint.create(id: arbitrary_id,
                          :series_id => @s.id, :date => '2011-03-01', :value => 100.0, :data_source_id => ds1.id, :current => true)
    newdp = dp.upd(100, ds2)
    cur_dps = @s.current_data_points

    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.id).not_to eq(arbitrary_id), 'a new dp was not created'
    expect(newdp.id).to eq(cur_dps.first.id), 'new dp not returned by current_data_points'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(dp.current).to eq(false), 'old dp still current'
    expect(newdp.value_equal_to? dp.value).to eq(true), 'dp values are not equal'
    expect(newdp.data_source_id).to eq(ds2.id), 'new dp does not have new source'
  end

  it 'should NOT update a data_points data source if source is different, source.priority < current' do
    ds1 = DataSource.create priority: 80
    ds2 = DataSource.create priority: 70
    arbitrary_id = 99  ## anything other than zero
    dp = DataPoint.create(id: arbitrary_id,
                          :series_id => @s.id, :date => '2011-03-01', :value => 100.0, :data_source_id => ds1.id, :current => true)
    newdp = dp.upd(100, ds2)
    cur_dps = @s.current_data_points

    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.first.id).to eq(arbitrary_id), 'current dp is a different from original'
    expect(dp.current).to eq(true), 'old data point no longer current'
    expect(dp.value_equal_to? 100.0).to eq(true), 'old data point value has changed in place'
    expect(dp.data_source_id).to eq(ds1.id), 'old data point source has changed in place'
  end

  it 'should update a data_points value if value is different, source.priority not < current' do
    ds1 = DataSource.create priority: 80
    ds2 = DataSource.create priority: 80
    arbitrary_id = 99  ## anything other than zero
    dp = DataPoint.create(id: arbitrary_id,
                          :series_id => @s.id, :date => '2011-03-01', :value => 100.0, :data_source_id => ds1.id, :current => true)
    newdp = dp.upd(200, ds2)
    cur_dps = @s.current_data_points

    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.id).not_to eq(arbitrary_id), 'a new dp was not created'
    expect(newdp.id).to eq(cur_dps.first.id), 'new dp not returned by current_data_points'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(dp.current).to eq(false), 'old dp still set to current'
    expect(newdp.value_equal_to? dp.value).to eq(false), 'new and old dp values are equal'
    expect(newdp.data_source_id).to eq(ds2.id), 'new dp doesnt have the new source'
  end

  it 'should NOT update a data_points value if value is different, source.priority < current' do
    ds1 = DataSource.create priority: 80
    ds2 = DataSource.create priority: 70
    arbitrary_id = 99  ## anything other than zero
    dp = DataPoint.create(id: arbitrary_id,
                          :series_id => @s.id, :date => '2011-03-01', :value => 100.0, :data_source_id => ds1.id, :current => true)
    newdp = dp.upd(200, ds2)
    cur_dps = @s.current_data_points

    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.first.id).to eq(arbitrary_id), 'current dp is a different from original'
    expect(dp.current).to eq(true), 'old data point no longer current'
    expect(dp.value_equal_to? 100.0).to eq(true), 'old data point value has changed in place'
    expect(dp.data_source_id).to eq(ds1.id), 'old data point source has changed in place'
  end

  xit 'should be able to clone itself but assign a new value, source_id' do
    ### this is basically covered by the above test:
    ###   'should update a data_points value if value is different, source.priority not < current'
  end

  ##### NEXT: write a bunch of tests for cases where there are multiple 'kin' data points and certain ones
  ##### are deleted, checking that the correct other dp is set to current, etc. This should cover the case
  ##### of the below test:

  xit %q"should make its 'next of kin' data point current if it's being deleted" do
    ds1 = DataSource.create
    dp = DataPoint.create(
        :series_id => @s.id,
        :date => '2011-03-01',
        :value => 100.0,
        :data_source_id => ds1.id,
        :current => true
    )

    sleep 1
    dp.upd(200, ds1)
    
    expect(@s.data_points.count).to eq(2)
    expect(@s.current_data_points.count).to eq(1)
    
    @s.current_data_points[0].delete

    expect(@s.data_points.count).to eq(1)
    expect(@s.current_data_points.count).to eq(1)
    expect(@s.current_data_points[0].id.to_s).to eq(dp.id.to_s)

    sleep 1  
    dp = DataPoint.where(:current => true).first
    dp2 = dp.upd(300, ds1)
      
    sleep 1
    dp2.upd(400, ds1)

  
    @s.current_data_points[0].delete

    expect(@s.data_points.count).to eq(2)
    expect(@s.current_data_points.count).to eq(1)
    expect(@s.current_data_points[0].id.to_s).to eq(dp2.id.to_s)
  end
end
